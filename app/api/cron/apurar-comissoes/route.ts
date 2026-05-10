/**
 * Cron mensal — apura comissão de contratos assinados sem ComissaoApurada.
 *
 * Trigger: GitHub Actions, mensal dia 1 03:00 UTC.
 * Auth: Authorization: Bearer ${CRON_SECRET}.
 *
 * Para cada contrato com statusAssinatura='assinado' SEM ComissaoApurada:
 *   1. Seleciona regra (selecionarRegra) considerando cultura/mesa/corretor/cliente.
 *   2. Calcula distribuição (distribuirComissao).
 *   3. Cria ComissaoApurada + MovimentoFinanceiro tipo='despesa' natureza='comissao'.
 *
 * Idempotente: contratoId é UNIQUE em ComissaoApurada — re-runs não duplicam.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  distribuirComissao,
  selecionarRegra,
  type RegraInput,
} from '@/lib/comissao/calcular'
import { captureError, captureMessage } from '@/lib/observability/capture'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

async function handle(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    captureMessage('cron apurar-comissoes: CRON_SECRET ausente', 'error')
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  let processados = 0
  let criados = 0
  let pulados = 0
  const erros: string[] = []

  try {
    // Contratos assinados sem comissão apurada ainda
    const contratos = await db.contrato.findMany({
      where: {
        statusAssinatura: 'assinado',
      },
      include: {
        proposta: {
          select: { valorTotal: true, graos: true },
        },
      },
    })

    function extrairCultura(graos: any): string | null {
      if (!graos) return null
      if (Array.isArray(graos) && graos[0]?.cultura) return String(graos[0].cultura)
      if (typeof graos === 'object' && (graos as any).cultura)
        return String((graos as any).cultura)
      return null
    }

    for (const contrato of contratos) {
      processados++
      try {
        const existente = await db.comissaoApurada.findUnique({
          where: { contratoId: contrato.id },
        })
        if (existente) {
          pulados++
          continue
        }

        const valorContrato = Number(contrato.proposta?.valorTotal ?? 0)
        if (!valorContrato || valorContrato <= 0) {
          pulados++
          continue
        }

        const regrasDb = await db.comissaoRegra.findMany({
          where: { workspaceId: contrato.workspaceId, ativo: true },
        })
        const regras: RegraInput[] = regrasDb.map((r) => ({
          id: r.id,
          pctTotal: r.pctTotal,
          pctCorretor: r.pctCorretor,
          pctOriginador: r.pctOriginador,
          pctMesa: r.pctMesa,
          pctHouse: r.pctHouse,
          escopoTipo: r.escopoTipo,
          escopoFiltro: (r.escopoFiltro as any) ?? null,
          ativo: r.ativo,
          prioridade: r.prioridade,
        }))

        const regra = selecionarRegra(regras, {
          cultura: extrairCultura(contrato.proposta?.graos),
          mesaId: contrato.mesaId,
          corretorId: contrato.corretorId,
          clienteId: contrato.clienteId,
        })
        if (!regra) {
          pulados++
          continue
        }

        const dist = distribuirComissao(regra, valorContrato)

        // Tenta achar originadorId via corretor (S6 M5: corretor pode ser também originador)
        let originadorId: string | null = null
        if (contrato.corretorId) {
          const cr = await db.corretor.findUnique({
            where: { id: contrato.corretorId },
            select: { id: true },
          })
          originadorId = cr?.id ?? null
        }

        await db.$transaction(async (tx) => {
          await tx.comissaoApurada.create({
            data: {
              workspaceId: contrato.workspaceId,
              contratoId: contrato.id,
              regraId: regra.id,
              valorContrato,
              pctTotalAplicado: regra.pctTotal,
              valorTotalComissao: dist.valorTotal,
              corretorId: contrato.corretorId,
              valorCorretor: dist.corretor,
              originadorId,
              valorOriginador: dist.originador,
              mesaId: contrato.mesaId,
              valorMesa: dist.mesa,
              valorHouse: dist.house,
              status: 'apurada',
            },
          })

          if (dist.valorTotal > 0) {
            await tx.movimentoFinanceiro.create({
              data: {
                workspaceId: contrato.workspaceId,
                data: new Date(),
                tipo: 'despesa',
                natureza: 'comissao',
                valor: dist.valorTotal,
                descricao: `Comissão contrato ${contrato.numero}`,
                contratoId: contrato.id,
                cultura: extrairCultura(contrato.proposta?.graos),
              },
            })
          }
        })
        criados++
      } catch (e: any) {
        erros.push(`${contrato.id}: ${e?.message ?? 'erro'}`)
        captureError(e, { contratoId: contrato.id })
      }
    }

    return NextResponse.json({
      ok: true,
      processados,
      criados,
      pulados,
      erros,
      duracao_ms: Date.now() - startedAt,
    })
  } catch (e: any) {
    captureError(e)
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'erro' },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  return handle(req)
}
export async function POST(req: Request) {
  return handle(req)
}
