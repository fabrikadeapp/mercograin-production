/**
 * Lógica pura de barter (insumo ↔ grão).
 * - Equivalência em sacas = valorTotal / precoFixadoSc
 * - Valida entradas e retorna 0 em casos inválidos.
 */

export interface InsumoInput {
  quantidade: number
  precoUnit: number // em R$
}

export interface BarterCalculo {
  valorTotal: number
  qtdGraoEquivalenteSc: number
}

/**
 * Calcula equivalência em sacas para um insumo dado o preço fixado por saca.
 */
export function calcularEquivalenciaGrao(
  valorTotalInsumo: number,
  precoFixadoSc: number
): number {
  if (
    !isFinite(valorTotalInsumo) ||
    !isFinite(precoFixadoSc) ||
    valorTotalInsumo <= 0 ||
    precoFixadoSc <= 0
  ) {
    return 0
  }
  return valorTotalInsumo / precoFixadoSc
}

/**
 * Calcula valorTotal e equivalência em sacas a partir de um insumo + preço grão.
 */
export function calcularBarter(
  insumo: InsumoInput,
  precoFixadoSc: number
): BarterCalculo {
  const valorTotal =
    isFinite(insumo.quantidade) && isFinite(insumo.precoUnit)
      ? Math.max(0, insumo.quantidade * insumo.precoUnit)
      : 0
  const qtdGraoEquivalenteSc = calcularEquivalenciaGrao(
    valorTotal,
    precoFixadoSc
  )
  return { valorTotal, qtdGraoEquivalenteSc }
}
