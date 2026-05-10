/**
 * Conversões CBOT ↔ BR — bushels, sacas, USD/bu ↔ R$/sc.
 *
 * Constantes oficiais:
 *  - 1 contrato CBOT = 5000 bushels
 *  - Soja: 1 bu = 60 lb = 27,2155 kg → 1 contrato = 136.077 kg
 *  - Milho: 1 bu = 56 lb = 25,4012 kg → 1 contrato = 127.006 kg
 *  - Trigo: 1 bu = 60 lb = 27,2155 kg → 1 contrato = 136.077 kg
 *  - Saca padrão BR: 60 kg
 */

export type CulturaCbot = 'ZS' | 'ZC' | 'ZW'

export interface ContratoCbotSpec {
  bushels: number
  kgPorBushel: number
  totalKg: number
}

export const CBOT_CONTRATO: Record<CulturaCbot, ContratoCbotSpec> = {
  ZS: { bushels: 5000, kgPorBushel: 27.2155, totalKg: 136077.5 }, // soja
  ZC: { bushels: 5000, kgPorBushel: 25.4012, totalKg: 127006.0 }, // milho
  ZW: { bushels: 5000, kgPorBushel: 27.2155, totalKg: 136077.5 }, // trigo
}

export const SACA_KG_PADRAO = 60

export function bushelsParaSacas(
  bushels: number,
  kgPorBushel: number,
  sacaKg = SACA_KG_PADRAO,
): number {
  return (bushels * kgPorBushel) / sacaKg
}

export function sacasParaBushels(
  sacas: number,
  kgPorBushel: number,
  sacaKg = SACA_KG_PADRAO,
): number {
  return (sacas * sacaKg) / kgPorBushel
}

/**
 * Converte preço USD/bushel para R$/saca:
 *   R$/sc = (USD/bu) * (USD/BRL) * (kg/sc) / (kg/bu)
 *         = (USD/bu) * (USD/BRL) * (sacaKg / kgPorBushel)
 */
export function precoUsdBuParaBrlSc(
  precoUsdBu: number,
  cambioUsdBrl: number,
  kgPorBushel: number,
  sacaKg = SACA_KG_PADRAO,
): number {
  return precoUsdBu * cambioUsdBrl * (sacaKg / kgPorBushel)
}

/**
 * Inversa: R$/sc → USD/bushel.
 */
export function precoBrlScParaUsdBu(
  precoBrlSc: number,
  cambioUsdBrl: number,
  kgPorBushel: number,
  sacaKg = SACA_KG_PADRAO,
): number {
  if (cambioUsdBrl <= 0) throw new Error('Câmbio inválido')
  return precoBrlSc / (cambioUsdBrl * (sacaKg / kgPorBushel))
}

/**
 * Equivalência em sacas: dado N contratos CBOT, retorna sacas equivalentes.
 */
export function contratosParaSacas(
  qtdContratos: number,
  cultura: CulturaCbot,
  sacaKg = SACA_KG_PADRAO,
): number {
  const spec = CBOT_CONTRATO[cultura]
  return (qtdContratos * spec.totalKg) / sacaKg
}
