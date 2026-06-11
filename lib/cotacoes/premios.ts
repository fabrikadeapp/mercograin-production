/**
 * Motor da Planilha Prêmios — cálculo do prêmio implícito (basis) a partir do
 * preço de balcão das tradings, por mês de vencimento.
 *
 * Lógica pura — não depende de DB nem de framework.
 *
 * Caminho inverso do simulador de exportação: parte do preço de BALCÃO em
 * R$/saca de 60 kg ofertado por uma trading e retorna o PRÊMIO implícito em
 * US$/bushel embutido nessa oferta, dado o câmbio e o Chicago (CBOT) do mês.
 *
 *   PREMIO_usd_bu =
 *     ( ( (PRECO_BALCAO_brl_sc ÷ CAMBIO) × 16,6667 + 12 ) ÷ 36,74541 ) − CHICAGO_usd_bu
 *
 *   onde:
 *     PRECO_BALCAO  = preço de balcão em R$/saca de 60 kg
 *     CAMBIO        = câmbio USD/BRL do mês de vencimento
 *     16,6667       = sacas de 60 kg por tonelada (1.000 ÷ 60)
 *     +12           = custo fixo FOBBINGS em US$/tonelada
 *     36,74541      = fator bushel→tonelada da soja
 *     CHICAGO       = cotação CBOT em US$/bushel do mês de vencimento
 *
 * A grade é [trading × mês]: cada mês de vencimento carrega seu próprio câmbio
 * e seu próprio Chicago (a curva), e cada trading tem um preço de balcão por mês.
 */

/** Sacas de 60 kg por tonelada métrica (1.000 kg ÷ 60 kg). */
export const SACAS_POR_TONELADA = 16.6667

/** Custo fixo de embarque (FOBBINGS) padrão em US$/tonelada. */
export const FOBBINGS_USD_TON_PADRAO = 12

/** Fator de conversão bushel→tonelada da soja usado na planilha. */
export const FATOR_BU_TON_SOJA = 36.74541

/** Tradings padrão da grade de prêmios, na ordem da planilha. */
export const TRADINGS_PADRAO = [
  'COFCO',
  'AMAGGI',
  'LDC',
  'ADM',
  'BUNGE',
  'OLAM',
  'CHS',
  'BTG',
  'CARGILL',
] as const

/**
 * Um mês de vencimento da curva: rótulo + câmbio e Chicago próprios desse mês.
 */
export type MesVencimento = {
  /** Rótulo do mês de vencimento (ex.: 'Jul/26' ou 'Mês 1'). */
  label: string
  /** Câmbio USD/BRL deste mês de vencimento. */
  cambio: number
  /** Cotação CBOT (Chicago) em US$/bushel deste mês de vencimento. */
  chicagoUsdBu: number
}

/** Entradas para o cálculo de UM prêmio implícito. */
export interface PremioInput {
  /** Preço de balcão ofertado em R$/saca de 60 kg. */
  precoBalcaoBrlSc: number
  /** Câmbio USD/BRL do mês de vencimento. */
  cambioUsdBrl: number
  /** Cotação CBOT (Chicago) em US$/bushel do mês de vencimento. */
  chicagoUsdBu: number
  /** Custo fixo FOBBINGS em US$/tonelada. Default 12. */
  fobbingsUsdTon?: number
  /** Fator bushel→tonelada. Default 36,74541 (soja). */
  fatorBuTon?: number
}

/**
 * Calcula o prêmio implícito (US$/bushel) embutido num preço de balcão.
 *
 * Retorna 0 quando o preço de balcão é <= 0 (sem oferta válida).
 */
export function calcularPremioImplicito(input: PremioInput): number {
  const {
    precoBalcaoBrlSc,
    cambioUsdBrl,
    chicagoUsdBu,
    fobbingsUsdTon = FOBBINGS_USD_TON_PADRAO,
    fatorBuTon = FATOR_BU_TON_SOJA,
  } = input

  if (!(precoBalcaoBrlSc > 0)) return 0
  if (!(cambioUsdBrl > 0) || !(fatorBuTon > 0)) return 0

  const usdPorTonelada = (precoBalcaoBrlSc / cambioUsdBrl) * SACAS_POR_TONELADA + fobbingsUsdTon
  const usdPorBushel = usdPorTonelada / fatorBuTon
  return usdPorBushel - chicagoUsdBu
}

/** Uma trading com seus preços de balcão por mês de vencimento. */
export interface TradingPremios {
  /** Nome da trading. */
  nome: string
  /** Preço de balcão (R$/sc60) por mês; null quando não há oferta para o mês. */
  precosPorMes: (number | null)[]
}

/**
 * Calcula a grade completa de prêmios implícitos [trading × mês].
 *
 * Cada célula usa o câmbio e o Chicago do mês correspondente. Retorna null na
 * célula quando o preço de balcão é null ou <= 0 (sem oferta válida).
 */
export function calcularGradePremios(
  tradings: TradingPremios[],
  meses: MesVencimento[],
): Array<{ nome: string; premios: (number | null)[] }> {
  return tradings.map((trading) => ({
    nome: trading.nome,
    premios: meses.map((mes, i) => {
      const preco = trading.precosPorMes[i]
      if (preco == null || !(preco > 0)) return null
      return calcularPremioImplicito({
        precoBalcaoBrlSc: preco,
        cambioUsdBrl: mes.cambio,
        chicagoUsdBu: mes.chicagoUsdBu,
      })
    }),
  }))
}

/**
 * Lista de tradings padrão com preços de balcão vazios (todos null) para `qtd`
 * meses. Serve de esqueleto para a grade editável.
 */
export function tradingsPremiosDefault(qtd = 12): TradingPremios[] {
  return TRADINGS_PADRAO.map((nome) => ({
    nome,
    precosPorMes: Array.from({ length: qtd }, () => null),
  }))
}

const MESES_ABREV = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

/**
 * Gera os próximos `qtd` meses de vencimento a partir de uma data base.
 *
 * - Se `dataBaseISO` for informada (ex.: '2026-06-11'), os rótulos são derivados
 *   dela no formato 'Mmm/AA' (ex.: 'Jun/26', 'Jul/26', ...).
 * - Se `dataBaseISO` NÃO for informada, usa rótulos genéricos 'Mês 1'..'Mês N'.
 *   A lib NUNCA consulta o relógio do sistema por conta própria — a data base
 *   deve sempre vir por parâmetro de quem chama.
 *
 * Câmbio e Chicago são inicializados em 0 (a serem preenchidos com a curva real).
 */
export function mesesDefault(dataBaseISO?: string, qtd = 12): MesVencimento[] {
  if (!dataBaseISO) {
    return Array.from({ length: qtd }, (_, i) => ({
      label: `Mês ${i + 1}`,
      cambio: 0,
      chicagoUsdBu: 0,
    }))
  }

  const base = new Date(`${dataBaseISO}T00:00:00Z`)
  const anoBase = base.getUTCFullYear()
  const mesBase = base.getUTCMonth()

  return Array.from({ length: qtd }, (_, i) => {
    const total = mesBase + i
    const ano = anoBase + Math.floor(total / 12)
    const mes = ((total % 12) + 12) % 12
    const aa = String(ano % 100).padStart(2, '0')
    return {
      label: `${MESES_ABREV[mes]}/${aa}`,
      cambio: 0,
      chicagoUsdBu: 0,
    }
  })
}
