/**
 * Helpers de formatação de preço (centavos → BRL e vice-versa).
 */

export function formatBRL(cents: number, currency = 'BRL'): string {
  const value = cents / 100
  try {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency,
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    })
  } catch {
    return `R$ ${value.toFixed(2)}`
  }
}

export function formatBRLShort(cents: number): string {
  // ex: 19700 -> "R$ 197"; 19750 -> "R$ 197,50"
  const v = cents / 100
  if (v % 1 === 0) {
    return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
  }
  return `R$ ${v.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * "R$ 197,50" / "197,50" / "1.497,00" → 19750
 */
export function parseBRLToCents(input: string): number {
  if (!input) return 0
  const cleaned = String(input)
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '') // remove milhar
    .replace(',', '.')
  const num = Number(cleaned)
  if (!Number.isFinite(num)) return 0
  return Math.round(num * 100)
}

export function formatIntervalLabel(interval: string, count = 1): string {
  const map: Record<string, [string, string]> = {
    day: ['/dia', `/${count} dias`],
    week: ['/sem', `/${count} semanas`],
    month: ['/mês', `/${count} meses`],
    year: ['/ano', `/${count} anos`],
  }
  const [single, plural] = map[interval] || ['', '']
  return count === 1 ? single : plural
}
