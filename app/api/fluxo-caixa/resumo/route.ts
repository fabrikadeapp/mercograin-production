/**
 * GET /api/fluxo-caixa/resumo
 * Consolida KPIs + projeção + a receber/pagar a partir de Boleto + Proposta.
 *
 * "A pagar" não tem model próprio ainda → MOCK server-side com TODO.
 * "Saldo atual" também não tem fonte de saldo bancário → derivamos
 * (boletos pagos cumulativos – mock-pagar cumulativo) como proxy.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// TODO: criar model FinanceiroPagar e remover este mock
const MOCK_PAGAR_PROX_7D = [
  { id: 'mp1', descricao: 'Frete · Transrodo Log.', doc: 'FT-1842', diasOffset: 0, valor: 184000, status: 'vencido' },
  { id: 'mp2', descricao: 'Armazenagem · CESP', doc: 'AM-0942', diasOffset: 1, valor: 96000, status: 'agendado' },
  { id: 'mp3', descricao: 'Insumos · Bayer', doc: 'NF-12842', diasOffset: 2, valor: 412000, status: 'agendado' },
  { id: 'mp4', descricao: 'Folha · 38 funcionários', doc: 'FL-10/26', diasOffset: 5, valor: 318000, status: 'agendado' },
  { id: 'mp5', descricao: 'Impostos · ICMS-ST', doc: 'GR-091026', diasOffset: 7, valor: 110000, status: 'atenção' },
]

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const userId = session.user.id
    const now = new Date()
    const in7 = new Date(now.getTime() + 7 * 86400000)
    const in30 = new Date(now.getTime() + 30 * 86400000)
    const in90 = new Date(now.getTime() + 90 * 86400000)
    const ago30 = new Date(now.getTime() - 30 * 86400000)

    const [pagosTotal, abertos30, vencidosAbertos, aReceberProx7d, propostasGrao, pagosUlt30, pagosAnt30] = await Promise.all([
      db.boleto.aggregate({
        where: { cliente: { usuarioId: userId }, status: 'pago' },
        _sum: { valor: true },
      }),
      db.boleto.findMany({
        where: {
          cliente: { usuarioId: userId },
          status: { in: ['aberto', 'vencido'] },
          vencimento: { lte: in30 },
        },
        select: { id: true, valor: true, status: true },
      }),
      db.boleto.count({
        where: { cliente: { usuarioId: userId }, status: 'vencido' },
      }),
      db.boleto.findMany({
        where: {
          cliente: { usuarioId: userId },
          status: { in: ['aberto', 'vencido'] },
          vencimento: { gte: now, lte: in7 },
        },
        select: {
          id: true,
          valor: true,
          vencimento: true,
          status: true,
          contrato: { select: { numero: true } },
          cliente: { select: { nome: true } },
        },
        orderBy: { vencimento: 'asc' },
        take: 10,
      }),
      db.proposta.findMany({
        where: { cliente: { usuarioId: userId }, status: 'aceita' },
        select: { graos: true, valorTotal: true },
      }),
      db.boleto.aggregate({
        where: { cliente: { usuarioId: userId }, status: 'pago', confirmadoEm: { gte: ago30 } },
        _sum: { valor: true },
      }),
      db.boleto.aggregate({
        where: {
          cliente: { usuarioId: userId },
          status: 'pago',
          confirmadoEm: { gte: new Date(ago30.getTime() - 30 * 86400000), lt: ago30 },
        },
        _sum: { valor: true },
      }),
    ])

    const totalAReceber30d = abertos30.reduce((s, b) => s + Number(b.valor), 0)
    const totalAtrasados = abertos30.filter((b) => b.status === 'vencido').length

    const totalAPagar30d = MOCK_PAGAR_PROX_7D.reduce((s, x) => s + x.valor, 0)
    const vencidosPagar = MOCK_PAGAR_PROX_7D.filter((x) => x.status === 'vencido').length

    const saldoAtual = Number(pagosTotal._sum.valor || 0) - totalAPagar30d * 0 // proxy: ignora pagamentos por enquanto
    const projecao90 = saldoAtual + totalAReceber30d * 3 - totalAPagar30d * 3

    const ult30 = Number(pagosUlt30._sum.valor || 0)
    const ant30 = Number(pagosAnt30._sum.valor || 0)
    const deltaSaldo = ant30 > 0 ? ((ult30 - ant30) / ant30) * 100 : 0

    // Composição: receita por grão (das propostas aceitas)
    const graoMap: Record<string, number> = { soja: 0, milho: 0, trigo: 0, outros: 0 }
    for (const p of propostasGrao) {
      const arr = Array.isArray(p.graos) ? (p.graos as any[]) : []
      for (const g of arr) {
        const key = ['soja', 'milho', 'trigo'].includes(g?.grao) ? g.grao : 'outros'
        graoMap[key] += Number(g?.subtotal || 0)
      }
    }
    const totalReceita = Object.values(graoMap).reduce((s, n) => s + n, 0) || 1
    const composicao = [
      { label: 'Receita Soja', valor: graoMap.soja, pct: (graoMap.soja / totalReceita) * 100, color: 'var(--accent)' },
      { label: 'Receita Milho', valor: graoMap.milho, pct: (graoMap.milho / totalReceita) * 100, color: 'var(--grain-milho)' },
      { label: 'Receita Trigo', valor: graoMap.trigo, pct: (graoMap.trigo / totalReceita) * 100, color: 'var(--grain-trigo)' },
      { label: 'Outras receitas', valor: graoMap.outros, pct: (graoMap.outros / totalReceita) * 100, color: 'var(--info)' },
    ]

    // Projeção 14 pontos diários (fluxo simples): receita média/dia – pagar média/dia
    const recPorDia = totalAReceber30d / 30
    const pagPorDia = totalAPagar30d / 30
    let saldo = saldoAtual
    const projecaoSerie: { label: string; value: number }[] = []
    for (let i = 0; i < 14; i++) {
      saldo += recPorDia - pagPorDia
      const d = new Date(now.getTime() + i * 86400000)
      projecaoSerie.push({
        label: `${MESES_PT[d.getMonth()]} ${d.getDate()}`,
        value: Math.round((saldo / 1_000_000) * 100) / 100,
      })
    }

    const aReceberProx7dPayload = aReceberProx7d.map((b) => ({
      id: b.id,
      cliente: b.cliente.nome,
      contrato: b.contrato?.numero || '—',
      vencimento: b.vencimento,
      valor: Number(b.valor),
      status: b.status,
    }))

    const aPagarProx7dPayload = MOCK_PAGAR_PROX_7D.map((x) => ({
      id: x.id,
      descricao: x.descricao,
      doc: x.doc,
      vencimento: new Date(now.getTime() + x.diasOffset * 86400000),
      valor: x.valor,
      status: x.status,
    }))

    return NextResponse.json({
      saldoAtual,
      aReceber30d: { total: totalAReceber30d, titulos: abertos30.length, atrasados: totalAtrasados },
      aPagar30d: { total: totalAPagar30d, compromissos: MOCK_PAGAR_PROX_7D.length, vencidos: vencidosPagar },
      projecao90d: projecao90,
      deltaSaldo,
      deltaAReceber: 0, // TODO: comparar com 30d atrás
      deltaAPagar: 0,
      deltaProjecao: 0,
      composicao,
      projecaoSerie,
      aReceberProx7d: aReceberProx7dPayload,
      aPagarProx7d: aPagarProx7dPayload,
      _flags: {
        pagarMock: true, // TODO: criar model FinanceiroPagar
      },
      vencidosAbertos,
      in90: in90.toISOString(),
    })
  } catch (e: any) {
    console.error('GET /fluxo-caixa/resumo error:', e)
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}
