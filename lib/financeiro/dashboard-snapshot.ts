/**
 * Snapshot agregado para o dashboard /financeiro.
 *
 * Consome MovimentoFinanceiro do workspace ativo. Mês corrente vs anterior,
 * receitas vs despesas, saldo do período. Tudo escopado por workspaceId.
 */

import { db } from '@/lib/db'

export interface FinanceiroSnapshot {
  mes: {
    receita: number
    despesa: number
    saldo: number
    receitaPrevMes: number
    despesaPrevMes: number
    movimentosCount: number
  }
  /** Série diária de 30 dias: receita e despesa por dia. */
  serie30d: Array<{ date: string; receita: number; despesa: number }>
  /** Distribuição por natureza nos últimos 30 dias. */
  porNatureza: Array<{ natureza: string; tipo: 'receita' | 'despesa'; total: number; count: number }>
  /** Últimos N movimentos. */
  ultimos: Array<{
    id: string
    data: string
    tipo: 'receita' | 'despesa' | 'transferencia'
    natureza: string
    valor: number
    descricao: string
    centroCusto: string | null
  }>
  /** Contagem de pendências (não conciliados). */
  naoConciliados: number
}

function startOfMonth(d: Date): Date {
  const s = new Date(d)
  s.setDate(1)
  s.setHours(0, 0, 0, 0)
  return s
}
function endOfMonth(d: Date): Date {
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  e.setHours(23, 59, 59, 999)
  return e
}

export async function loadFinanceiroSnapshot(workspaceId: string): Promise<FinanceiroSnapshot> {
  const hoje = new Date()
  const inicioMes = startOfMonth(hoje)
  const fimMes = endOfMonth(hoje)
  const inicioMesAnt = startOfMonth(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1))
  const fimMesAnt = endOfMonth(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1))
  const inicio30d = new Date(hoje)
  inicio30d.setDate(inicio30d.getDate() - 29)
  inicio30d.setHours(0, 0, 0, 0)

  const [thisMonth, prevMonth, last30d, ultimos, naoConciliados] = await Promise.all([
    // Mês corrente (aggregate por tipo)
    db.movimentoFinanceiro.groupBy({
      by: ['tipo'],
      where: { workspaceId, data: { gte: inicioMes, lte: fimMes } },
      _sum: { valor: true },
      _count: { _all: true },
    }),
    // Mês anterior
    db.movimentoFinanceiro.groupBy({
      by: ['tipo'],
      where: { workspaceId, data: { gte: inicioMesAnt, lte: fimMesAnt } },
      _sum: { valor: true },
    }),
    // Últimos 30 dias com data — para série diária + por natureza
    db.movimentoFinanceiro.findMany({
      where: { workspaceId, data: { gte: inicio30d } },
      select: { data: true, tipo: true, natureza: true, valor: true },
      take: 5000,
    }),
    // Últimos lançamentos
    db.movimentoFinanceiro.findMany({
      where: { workspaceId },
      orderBy: { data: 'desc' },
      take: 8,
      include: { centroCusto: { select: { codigo: true, nome: true } } },
    }),
    db.movimentoFinanceiro.count({
      where: { workspaceId, conciliado: false, tipo: { not: 'transferencia' } },
    }),
  ])

  const sumByTipo = (
    rows: Array<{ tipo: string; _sum: { valor: { toString(): string } | null } }>,
    tipo: 'receita' | 'despesa'
  ): number => {
    const r = rows.find((x) => x.tipo === tipo)
    return r?._sum.valor != null ? Number(r._sum.valor) : 0
  }

  const receita = sumByTipo(thisMonth as Array<{ tipo: string; _sum: { valor: { toString(): string } | null } }>, 'receita')
  const despesa = sumByTipo(thisMonth as Array<{ tipo: string; _sum: { valor: { toString(): string } | null } }>, 'despesa')
  const receitaPrev = sumByTipo(prevMonth as Array<{ tipo: string; _sum: { valor: { toString(): string } | null } }>, 'receita')
  const despesaPrev = sumByTipo(prevMonth as Array<{ tipo: string; _sum: { valor: { toString(): string } | null } }>, 'despesa')

  const movCount = (thisMonth as Array<{ _count?: { _all?: number } }>).reduce(
    (acc, r) => acc + (r._count?._all ?? 0),
    0
  )

  // Série diária 30d
  const dayMap = new Map<string, { receita: number; despesa: number }>()
  for (let i = 0; i < 30; i++) {
    const d = new Date(inicio30d)
    d.setDate(d.getDate() + i)
    dayMap.set(d.toISOString().slice(0, 10), { receita: 0, despesa: 0 })
  }
  // Aggregação por natureza
  const natMap = new Map<string, { tipo: 'receita' | 'despesa'; total: number; count: number }>()
  for (const m of last30d) {
    const key = m.data.toISOString().slice(0, 10)
    const bucket = dayMap.get(key)
    if (bucket) {
      if (m.tipo === 'receita') bucket.receita += Number(m.valor)
      else if (m.tipo === 'despesa') bucket.despesa += Number(m.valor)
    }
    if (m.tipo === 'receita' || m.tipo === 'despesa') {
      const natKey = `${m.tipo}:${m.natureza}`
      const cur = natMap.get(natKey) ?? { tipo: m.tipo as 'receita' | 'despesa', total: 0, count: 0 }
      cur.total += Number(m.valor)
      cur.count += 1
      natMap.set(natKey, cur)
    }
  }
  const serie30d = Array.from(dayMap.entries()).map(([date, v]) => ({
    date,
    receita: Math.round(v.receita * 100) / 100,
    despesa: Math.round(v.despesa * 100) / 100,
  }))
  const porNatureza = Array.from(natMap.entries())
    .map(([key, v]) => ({
      natureza: key.split(':')[1] ?? key,
      tipo: v.tipo,
      total: Math.round(v.total * 100) / 100,
      count: v.count,
    }))
    .sort((a, b) => b.total - a.total)

  return {
    mes: {
      receita: Math.round(receita * 100) / 100,
      despesa: Math.round(despesa * 100) / 100,
      saldo: Math.round((receita - despesa) * 100) / 100,
      receitaPrevMes: Math.round(receitaPrev * 100) / 100,
      despesaPrevMes: Math.round(despesaPrev * 100) / 100,
      movimentosCount: movCount,
    },
    serie30d,
    porNatureza,
    ultimos: ultimos.map((m) => ({
      id: m.id,
      data: m.data.toISOString(),
      tipo: m.tipo as 'receita' | 'despesa' | 'transferencia',
      natureza: m.natureza,
      valor: Number(m.valor),
      descricao: m.descricao,
      centroCusto: m.centroCusto
        ? `${m.centroCusto.codigo} · ${m.centroCusto.nome}`
        : null,
    })),
    naoConciliados,
  }
}
