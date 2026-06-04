/**
 * GET /api/fluxo-caixa/resumo
 * Consolida KPIs + projeção + a receber/pagar a partir de Boleto + MovimentoFinanceiro.
 *
 * Mudanças vs versão anterior:
 *  - "A pagar" agora vem de MovimentoFinanceiro (tipo='despesa', !conciliado).
 *  - SaldoAtual = boletos pagos - despesas conciliadas (proxy honesto).
 *  - Removidos MOCK_PAGAR_PROX_7D e _flags.pagarMock.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereOwn: any = scope.whereOwn()
    const now = new Date()
    const in7 = new Date(now.getTime() + 7 * 86400000)
    const in30 = new Date(now.getTime() + 30 * 86400000)
    const in90 = new Date(now.getTime() + 90 * 86400000)
    const ago30 = new Date(now.getTime() - 30 * 86400000)

    const [
      pagosTotal,
      despesasConciliadasTotal,
      abertos30,
      vencidosAbertos,
      aReceberProx7d,
      aPagarProx7d,
      despesasAbertas30,
      vencidasPagar,
      propostasGrao,
      pagosUlt30,
      pagosAnt30,
    ] = await Promise.all([
      db.boleto.aggregate({
        where: { ...whereOwn, status: 'pago' },
        _sum: { valor: true },
      }),
      db.movimentoFinanceiro.aggregate({
        where: { ...whereOwn, tipo: 'despesa', conciliado: true },
        _sum: { valor: true },
      }),
      db.boleto.findMany({
        where: {
          ...whereOwn,
          status: { in: ['aberto', 'vencido'] },
          vencimento: { lte: in30 },
        },
        select: { id: true, valor: true, status: true },
      }),
      db.boleto.count({ where: { ...whereOwn, status: 'vencido' } }),
      db.boleto.findMany({
        where: {
          ...whereOwn,
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
      db.movimentoFinanceiro.findMany({
        where: {
          ...whereOwn,
          tipo: 'despesa',
          conciliado: false,
          data: { gte: now, lte: in7 },
        },
        select: {
          id: true,
          descricao: true,
          natureza: true,
          valor: true,
          data: true,
        },
        orderBy: { data: 'asc' },
        take: 10,
      }),
      db.movimentoFinanceiro.findMany({
        where: {
          ...whereOwn,
          tipo: 'despesa',
          conciliado: false,
          data: { lte: in30 },
        },
        select: { id: true, valor: true, data: true },
      }),
      db.movimentoFinanceiro.count({
        where: {
          ...whereOwn,
          tipo: 'despesa',
          conciliado: false,
          data: { lt: now },
        },
      }),
      db.proposta.findMany({
        where: { ...whereOwn, status: 'aceita' },
        select: { graos: true, valorTotal: true },
      }),
      db.boleto.aggregate({
        where: { ...whereOwn, status: 'pago', confirmadoEm: { gte: ago30 } },
        _sum: { valor: true },
      }),
      db.boleto.aggregate({
        where: {
          ...whereOwn,
          status: 'pago',
          confirmadoEm: {
            gte: new Date(ago30.getTime() - 30 * 86400000),
            lt: ago30,
          },
        },
        _sum: { valor: true },
      }),
    ])

    const totalAReceber30d = abertos30.reduce((s, b) => s + Number(b.valor), 0)
    const totalAtrasados = abertos30.filter((b) => b.status === 'vencido').length

    const totalAPagar30d = despesasAbertas30.reduce(
      (s, d) => s + Number(d.valor),
      0,
    )

    // Saldo proxy = entradas confirmadas - saídas conciliadas
    const saldoAtual =
      Number(pagosTotal._sum.valor || 0) -
      Number(despesasConciliadasTotal._sum.valor || 0)
    const projecao90 = saldoAtual + totalAReceber30d * 3 - totalAPagar30d * 3

    const ult30 = Number(pagosUlt30._sum.valor || 0)
    const ant30 = Number(pagosAnt30._sum.valor || 0)
    const deltaSaldo = ant30 > 0 ? ((ult30 - ant30) / ant30) * 100 : 0

    // Composição por grão (propostas aceitas)
    const graoMap: Record<string, number> = { soja: 0, milho: 0, trigo: 0, outros: 0 }
    for (const p of propostasGrao) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // Projeção 14 dias (linear simples)
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
    const aPagarProx7dPayload = aPagarProx7d.map((d) => ({
      id: d.id,
      descricao: d.descricao,
      doc: d.natureza,
      vencimento: d.data,
      valor: Number(d.valor),
      status: d.data < now ? 'vencido' : 'agendado',
    }))

    return NextResponse.json({
      saldoAtual,
      aReceber30d: {
        total: totalAReceber30d,
        titulos: abertos30.length,
        atrasados: totalAtrasados,
      },
      aPagar30d: {
        total: totalAPagar30d,
        compromissos: despesasAbertas30.length,
        vencidos: vencidasPagar,
      },
      projecao90d: projecao90,
      deltaSaldo,
      // Deltas comparados com janelas 30d anteriores ainda não calculados —
      // expostos como null para o frontend renderizar "—".
      deltaAReceber: null,
      deltaAPagar: null,
      deltaProjecao: null,
      composicao,
      projecaoSerie,
      aReceberProx7d: aReceberProx7dPayload,
      aPagarProx7d: aPagarProx7dPayload,
      vencidosAbertos,
      in90: in90.toISOString(),
    })
  } catch (e: unknown) {
    console.error('GET /fluxo-caixa/resumo error:', e)
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}
