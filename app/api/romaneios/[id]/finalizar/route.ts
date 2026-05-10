import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { nextNumero } from '@/lib/operacao-fisica/numbering'

const finalizarSchema = z.object({
  armazemId: z.string(),
  loteId: z.string().optional().nullable(), // se não passar, cria lote novo
})

const KG_POR_SACA = 60

/**
 * Finaliza romaneio: muda status para 'recebido', atualiza/cria lote
 * a partir da soma dos pesos líquidos finais (após classificação) dos
 * tickets vinculados, e registra movimentação de entrada.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const data = finalizarSchema.parse(body)

    const romaneio = await db.romaneio.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: { ticketsBalanca: { include: { classificacao: true } } },
    })
    if (!romaneio)
      return NextResponse.json({ error: 'Romaneio não encontrado' }, { status: 404 })
    if (romaneio.status === 'recebido' || romaneio.status === 'cancelado') {
      return NextResponse.json(
        { error: `Romaneio já está ${romaneio.status}` },
        { status: 409 }
      )
    }
    if (romaneio.ticketsBalanca.length === 0) {
      return NextResponse.json(
        { error: 'Romaneio sem tickets de balança vinculados' },
        { status: 400 }
      )
    }

    const armazem = await db.armazem.findFirst({
      where: { id: data.armazemId, ...scope.whereOwn() },
    })
    if (!armazem) return NextResponse.json({ error: 'Armazém inválido' }, { status: 400 })

    // Soma de pesos efetivos: classificacao.pesoLiquidoFinalKg ou ticket.pesoLiquidoKg
    const totalKg = romaneio.ticketsBalanca.reduce((acc, t) => {
      const efetivo = t.classificacao?.pesoLiquidoFinalKg ?? t.pesoLiquidoKg
      return acc + (efetivo || 0)
    }, 0)
    const totalSc = totalKg / KG_POR_SACA

    // Médias ponderadas de umidade/impureza
    let umidadeAcc = 0,
      impurezaAcc = 0,
      pesoClassif = 0
    for (const t of romaneio.ticketsBalanca) {
      if (t.classificacao && t.pesoLiquidoKg > 0) {
        umidadeAcc += t.classificacao.umidade * t.pesoLiquidoKg
        impurezaAcc += t.classificacao.impureza * t.pesoLiquidoKg
        pesoClassif += t.pesoLiquidoKg
      }
    }
    const umidadeMedia = pesoClassif > 0 ? umidadeAcc / pesoClassif : null
    const impurezaMedia = pesoClassif > 0 ? impurezaAcc / pesoClassif : null

    const result = await db.$transaction(async (tx) => {
      let lote
      if (data.loteId) {
        const existing = await tx.loteEstoque.findFirst({
          where: { id: data.loteId, workspaceId: scope.workspaceId },
        })
        if (!existing) throw new Error('Lote informado inválido')
        lote = await tx.loteEstoque.update({
          where: { id: existing.id },
          data: { qtdAtualSc: existing.qtdAtualSc + totalSc },
        })
      } else {
        const numero = await nextNumero('lote', scope.workspaceId)
        lote = await tx.loteEstoque.create({
          data: {
            numero,
            cultura: romaneio.cultura,
            safraId: romaneio.safraId,
            armazemId: data.armazemId,
            qtdInicialSc: totalSc,
            qtdAtualSc: totalSc,
            umidadeMedia,
            impurezaMedia,
            workspaceId: scope.workspaceId,
          },
        })
      }
      await tx.movimentacaoLote.create({
        data: {
          workspaceId: scope.workspaceId,
          loteId: lote.id,
          tipo: 'entrada',
          qtdSc: totalSc,
          motivo: `Recepção do romaneio ${romaneio.numero}`,
        },
      })
      // Vincular tickets ao lote
      await tx.ticketBalanca.updateMany({
        where: { romaneioId: romaneio.id, workspaceId: scope.workspaceId },
        data: { loteId: lote.id, status: 'finalizado' },
      })
      const updated = await tx.romaneio.update({
        where: { id: romaneio.id },
        data: { status: 'recebido', dataChegada: new Date() },
      })
      return { romaneio: updated, lote, totalSc, totalKg }
    })
    return NextResponse.json(result)
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
    console.error('finalizar romaneio error', e)
    return NextResponse.json(
      { error: e.message || 'Erro ao finalizar' },
      { status: 500 }
    )
  }
}
