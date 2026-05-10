/**
 * Análise de Curva ABC (Pareto) — classifica itens em A (80%), B (15%), C (5%).
 */

export interface CurvaABCItem<T> {
  item: T
  valor: number
  percentual: number
  percentualAcumulado: number
  classificacao: 'A' | 'B' | 'C'
}

export interface CurvaABCConfig {
  /** % acumulado de corte para classe A (default 80) */
  corteA?: number
  /** % acumulado de corte para classe B (default 95 = 80+15) */
  corteB?: number
}

export function calcularCurvaABC<T>(
  itens: T[],
  getValor: (item: T) => number,
  config: CurvaABCConfig = {}
): CurvaABCItem<T>[] {
  const corteA = config.corteA ?? 80
  const corteB = config.corteB ?? 95

  const ordenados = [...itens]
    .map((item) => ({ item, valor: Math.max(0, Number(getValor(item)) || 0) }))
    .sort((a, b) => b.valor - a.valor)

  const total = ordenados.reduce((s, x) => s + x.valor, 0)
  if (total <= 0) {
    return ordenados.map((x) => ({
      item: x.item,
      valor: x.valor,
      percentual: 0,
      percentualAcumulado: 0,
      classificacao: 'C' as const,
    }))
  }

  let acc = 0
  return ordenados.map((x) => {
    const pct = (x.valor / total) * 100
    acc += pct
    let classificacao: 'A' | 'B' | 'C'
    if (acc <= corteA) classificacao = 'A'
    else if (acc <= corteB) classificacao = 'B'
    else classificacao = 'C'
    return {
      item: x.item,
      valor: x.valor,
      percentual: round2(pct),
      percentualAcumulado: round2(acc),
      classificacao,
    }
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
