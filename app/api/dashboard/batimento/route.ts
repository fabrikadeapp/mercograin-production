/**
 * GET /api/dashboard/batimento
 * Calcula percentual de batimento de meta por grão e operação (compra/venda)
 * + margem média por saca, baseado em propostas aceitas / contratos assinados.
 *
 * Como o model Contrato atual NÃO possui campos `tipoOperacao`/`grao`/`volumeSc`
 * diretamente, derivamos dessas informações via Proposta vinculada (que tem
 * `tipo` ['venda'|'compra'] e `graos` JSON com `[{grao, quantidade, preco}]`).
 *
 * Metas: configuráveis. Sem fonte ainda, usamos METAS_DEFAULT por grão (em sacas).
 * Quando o volume realizado / meta = 0, retorna 0% (empty-friendly).
 */
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

// TODO: mover para tabela de configuração
const METAS_DEFAULT: Record<string, { compra: number; venda: number }> = {
  soja: { compra: 200000, venda: 200000 },
  milho: { compra: 100000, venda: 100000 },
  trigo: { compra: 40000, venda: 40000 },
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Contratos assinados deste usuário, com proposta+grãos
    const contratos = await db.contrato.findMany({
      where: {
        cliente: { usuarioId: session.user.id },
        statusAssinatura: 'assinado',
      },
      include: {
        proposta: { select: { tipo: true, graos: true, valorTotal: true } },
      },
    })

    const acc: Record<string, { compra: number; venda: number }> = {
      soja: { compra: 0, venda: 0 },
      milho: { compra: 0, venda: 0 },
      trigo: { compra: 0, venda: 0 },
    }

    let valorTotal = 0
    let volumeTotal = 0

    for (const c of contratos) {
      const tipo = (c.proposta?.tipo || 'venda') as 'compra' | 'venda'
      const graos = Array.isArray(c.proposta?.graos)
        ? (c.proposta?.graos as any[])
        : []
      for (const g of graos) {
        const grao = String(g?.grao || '').toLowerCase()
        const qtd = Number(g?.quantidade || 0)
        if (acc[grao] && qtd > 0) acc[grao][tipo] += qtd
        volumeTotal += qtd
      }
      valorTotal += Number(c.proposta?.valorTotal || 0)
    }

    const pct = (real: number, meta: number) =>
      meta > 0 ? Math.min(100, Math.round((real / meta) * 100)) : 0

    const margemMediaSc =
      volumeTotal > 0 ? Math.round((valorTotal / volumeTotal) * 100) / 100 : 0
    // assume meta de margem por saca = R$ 50; % do progresso vs meta (cap 100)
    const metaMargem = 50
    const margemPct =
      metaMargem > 0
        ? Math.min(100, Math.round((margemMediaSc / metaMargem) * 100))
        : 0

    return NextResponse.json({
      itens: [
        {
          label: 'Soja · Comprada',
          value: pct(acc.soja.compra, METAS_DEFAULT.soja.compra),
          color: 'var(--accent)',
        },
        {
          label: 'Milho · Comprada',
          value: pct(acc.milho.compra, METAS_DEFAULT.milho.compra),
          color: 'var(--grain-milho)',
        },
        {
          label: 'Trigo · Comprada',
          value: pct(acc.trigo.compra, METAS_DEFAULT.trigo.compra),
          color: 'var(--grain-trigo)',
        },
        {
          label: 'Soja · Vendida',
          value: pct(acc.soja.venda, METAS_DEFAULT.soja.venda),
          color: 'var(--accent)',
        },
        {
          label: 'Milho · Vendida',
          value: pct(acc.milho.venda, METAS_DEFAULT.milho.venda),
          color: 'var(--grain-milho)',
        },
        {
          label: 'Margem por saca',
          value: margemPct,
          color: 'var(--grain-trigo)',
        },
      ],
      totais: { volumeSc: volumeTotal, valorBRL: valorTotal },
    })
  } catch (e: any) {
    console.error('GET /dashboard/batimento error:', e)
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}
