/**
 * BH Grain — Cálculo de margem estimada (função pura).
 *
 * Margem comercial bruta. NÃO inclui impostos/comissões — para isso o sistema
 * já tem lib/calculo/ específico. Aqui é só lucro = receita − custo direto.
 */

export interface MargemInput {
  precoVenda: number // R$/unidade
  custoUnitario: number | null // R$/unidade
  quantidade: number
  freteUnitario?: number | null // R$/unidade (opcional)
}

export interface MargemResult {
  valorTotal: number
  custoTotal: number | null
  lucroBruto: number | null
  margemPercent: number | null
}

export function calcularMargem(input: MargemInput): MargemResult {
  const valorTotal = round2(input.precoVenda * input.quantidade)

  if (input.custoUnitario == null) {
    return { valorTotal, custoTotal: null, lucroBruto: null, margemPercent: null }
  }

  const custoBase = input.custoUnitario + (input.freteUnitario ?? 0)
  const custoTotal = round2(custoBase * input.quantidade)
  const lucroBruto = round2(valorTotal - custoTotal)
  const margemPercent = valorTotal > 0 ? round3((lucroBruto / valorTotal) * 100) : 0

  return { valorTotal, custoTotal, lucroBruto, margemPercent }
}

export function abaixoDaMargemMinima(
  margemPercent: number | null,
  minimo: number | null
): boolean {
  if (margemPercent == null || minimo == null) return false
  return margemPercent < minimo
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
