/**
 * S10 M2 — Aceitar Oferta → cria Proposta + marca oferta='aceita'.
 *
 * Regras:
 *  - Oferta deve estar 'aberta' e ainda dentro de `validaAte`.
 *  - Quem aceita pode ser:
 *      - Mesmo workspace que criou (matching interno entre operadores), OU
 *      - Workspace diferente, desde que a oferta esteja `publica=true`
 *        (marketplace cross-tenant).
 *  - Proposta é criada no workspace de QUEM ACEITA.
 *  - Requer `clienteId` (contraparte) — body obrigatório.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

const aceitarSchema = z.object({
  clienteId: z.string().min(3),
  observacoes: z.string().max(2000).optional().nullable(),
})

function novoNumeroProposta(): string {
  const now = new Date()
  const yyyymm = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `PROP-${yyyymm}-${rand}`
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = aceitarSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', issues: parsed.error.issues }, { status: 400 })
  }

  const oferta = await db.oferta.findUnique({ where: { id: ctx.params.id } })
  if (!oferta) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (oferta.status !== 'aberta') {
    return NextResponse.json({ error: 'oferta_indisponivel', status: oferta.status }, { status: 409 })
  }
  if (oferta.validaAte < new Date()) {
    // Marca como expirada e bloqueia
    await db.oferta.update({ where: { id: oferta.id }, data: { status: 'expirada' } }).catch(() => {})
    return NextResponse.json({ error: 'oferta_expirada' }, { status: 409 })
  }
  // Multi-tenant: workspace diferente só pode aceitar se publica=true
  const crossWorkspace = oferta.workspaceId !== scope.workspaceId
  if (crossWorkspace && !oferta.publica) {
    return NextResponse.json({ error: 'forbidden_cross_tenant' }, { status: 403 })
  }

  // Confirma que o cliente pertence ao workspace de quem aceita
  const cliente = await db.cliente.findFirst({
    where: { id: parsed.data.clienteId, workspaceId: scope.workspaceId },
    select: { id: true },
  })
  if (!cliente) return NextResponse.json({ error: 'cliente_invalido' }, { status: 400 })

  const qtdSc = Number(oferta.qtdSc)
  const precoSc = Number(oferta.precoSc)
  const valorTotal = +(qtdSc * precoSc).toFixed(2)
  const validadeProposta = new Date(Date.now() + 7 * 24 * 3600_000)

  // Transação: cria Proposta e marca Oferta. Se algo falhar, rollback.
  const result = await db.$transaction(async (tx) => {
    const proposta = await tx.proposta.create({
      data: {
        numero: novoNumeroProposta(),
        clienteId: cliente.id,
        // Espelha o sentido: se oferta é de COMPRA, o aceitante VENDE pro originador.
        tipo: oferta.tipo === 'compra' ? 'venda' : 'compra',
        graos: [
          { cultura: oferta.cultura, qtdSc, precoSc, moeda: oferta.precoMoeda },
        ] as any,
        valorTotal,
        status: 'enviada',
        descricao: `Origem: Oferta ${oferta.numero}`,
        observacoes: parsed.data.observacoes ?? null,
        validadeEm: validadeProposta,
        enviadaEm: new Date(),
        workspaceId: scope.workspaceId,
      },
    })
    const ofertaAtualizada = await tx.oferta.update({
      where: { id: oferta.id },
      data: { status: 'aceita', propostaId: proposta.id },
    })
    return { proposta, oferta: ofertaAtualizada }
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'aceitar',
    entidade: 'oferta',
    entidadeId: oferta.id,
    mudancas: {
      crossWorkspace,
      ofertaWorkspaceId: oferta.workspaceId,
      propostaId: result.proposta.id,
      propostaNumero: result.proposta.numero,
    },
  })

  return NextResponse.json(result, { status: 201 })
}
