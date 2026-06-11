/**
 * Simulador de Preço CBOT — formação de preço de exportação de grãos.
 *
 * Lógica pura — não depende de DB nem de framework.
 *
 * Replica a cadeia de price discovery da mesa de originação:
 *
 *   CBOT (US¢/bu) + Prêmio (US¢/bu)  →  US$/bushel
 *     × fator bushel→tonelada (USDA)  →  US$/tonelada
 *     + FOBBINGS (US$/t, custo de embarque, negativo)
 *     ÷ 16,667 (1.000 kg ÷ 60 kg)     →  US$/saca de 60 kg (preço porto)
 *     × câmbio USD/BRL                →  R$/saca (preço porto / FOB porto)
 *     − frete rodoviário (R$/saca)    →  R$/saca FOB origem (porteira)
 *
 * O fator bushel→tonelada é derivado da densidade USDA do grão
 * (1.000 kg ÷ kg_por_bu). Para soja dá 36,7437; milho 39,3681; trigo 36,7437,
 * coerente com a planilha SIMULADOR CBOT AUTO (36,7454 / 39,37) a menos do
 * arredondamento.
 */

import { KG_POR_BU, KG_POR_SC, type Grao } from './unidades'

export type GraoSimulador = Extract<Grao, 'soja' | 'milho' | 'trigo'>

/** kg por saca convertido para sacas por tonelada (1.000 / kg_por_sc). Soja: 16,667. */
function sacasPorTonelada(grao: GraoSimulador): number {
  return 1000 / KG_POR_SC[grao]
}

/** Fator de conversão US$/bushel → US$/tonelada (1.000 / kg_por_bu). */
export function fatorBushelTonelada(grao: GraoSimulador): number {
  return 1000 / KG_POR_BU[grao]
}

export interface SimuladorInput {
  grao: GraoSimulador
  /** Cotação CBOT em centavos de dólar por bushel (US¢/bu). Ex.: 1320 = US$ 13,20/bu. */
  cbotCentavosBu: number
  /** Prêmio (basis) de exportação em centavos de dólar por bushel (US¢/bu). Pode ser negativo. */
  premioCentavosBu: number
  /** FOBBINGS — custo de elevação/embarque no porto, em US$/tonelada. Tipicamente negativo (ex.: -10). */
  fobbingsUsdTon: number
  /** Câmbio USD/BRL. Ex.: 5,40. */
  cambioUsdBrl: number
  /** Frete rodoviário até o porto, em R$/saca de 60 kg. Desconta do preço porto para chegar ao FOB origem. */
  fretePorSacaBrl: number
}

export interface LinhaSimulador {
  rotulo: string
  /** Valor da etapa, na unidade indicada em `unidade`. */
  valor: number
  unidade: string
  detalhe?: string
}

export interface SimuladorOutput {
  /** US$/bushel = (cbot + premio) / 100. */
  usdPorBushel: number
  /** US$/tonelada antes de FOBBINGS. */
  usdPorToneladaBruto: number
  /** US$/tonelada após FOBBINGS. */
  usdPorToneladaLiquido: number
  /** US$/saca de 60 kg. */
  usdPorSaca: number
  /** R$/saca posto no porto (FOB porto). */
  brlPorSacaPorto: number
  /** R$/saca FOB origem (após desconto de frete) — preço-porteira. */
  brlPorSacaFobOrigem: number
  /** Detalhamento passo a passo da formação de preço. */
  linhas: LinhaSimulador[]
}

/**
 * Calcula a formação de preço de exportação a partir dos parâmetros de mercado.
 * Determinística e sem efeitos colaterais.
 */
export function simularPrecoGrao(input: SimuladorInput): SimuladorOutput {
  const { grao, cbotCentavosBu, premioCentavosBu, fobbingsUsdTon, cambioUsdBrl, fretePorSacaBrl } =
    input

  const fatorBuTon = fatorBushelTonelada(grao)
  const scPorTon = sacasPorTonelada(grao)

  // 1. CBOT + prêmio → US$/bushel
  const usdPorBushel = (cbotCentavosBu + premioCentavosBu) / 100

  // 2. → US$/tonelada (bruto, antes de custos de embarque)
  const usdPorToneladaBruto = usdPorBushel * fatorBuTon

  // 3. + FOBBINGS (custo de embarque, normalmente negativo) → US$/tonelada líquido
  const usdPorToneladaLiquido = usdPorToneladaBruto + fobbingsUsdTon

  // 4. ÷ sacas por tonelada → US$/saca de 60 kg
  const usdPorSaca = usdPorToneladaLiquido / scPorTon

  // 5. × câmbio → R$/saca posto no porto (FOB porto)
  const brlPorSacaPorto = usdPorSaca * cambioUsdBrl

  // 6. − frete rodoviário → R$/saca FOB origem (porteira)
  const brlPorSacaFobOrigem = brlPorSacaPorto - fretePorSacaBrl

  const linhas: LinhaSimulador[] = [
    {
      rotulo: 'CBOT + Prêmio',
      valor: usdPorBushel,
      unidade: 'US$/bu',
      detalhe: `CBOT ${cbotCentavosBu.toFixed(2)}¢ + prêmio ${premioCentavosBu.toFixed(2)}¢`,
    },
    {
      rotulo: 'Preço em tonelada',
      valor: usdPorToneladaBruto,
      unidade: 'US$/t',
      detalhe: `× ${fatorBuTon.toFixed(4)} (bushel→tonelada, ${grao})`,
    },
    {
      rotulo: 'FOBBINGS',
      valor: fobbingsUsdTon,
      unidade: 'US$/t',
      detalhe: 'Custo de elevação/embarque no porto',
    },
    {
      rotulo: 'Preço em saca (USD)',
      valor: usdPorSaca,
      unidade: 'US$/sc',
      detalhe: `÷ ${scPorTon.toFixed(3)} sacas/tonelada`,
    },
    {
      rotulo: 'Preço FOB porto',
      valor: brlPorSacaPorto,
      unidade: 'R$/sc',
      detalhe: `× câmbio ${cambioUsdBrl.toFixed(4)} USD/BRL`,
    },
    {
      rotulo: 'Frete até o porto',
      valor: -fretePorSacaBrl,
      unidade: 'R$/sc',
      detalhe: `R$ ${fretePorSacaBrl.toFixed(2)}/sc`,
    },
  ]

  return {
    usdPorBushel,
    usdPorToneladaBruto,
    usdPorToneladaLiquido,
    usdPorSaca,
    brlPorSacaPorto,
    brlPorSacaFobOrigem,
    linhas,
  }
}

/** Linha de comprador (trading) — prêmio próprio sobre a base. */
export interface TradingInput {
  nome: string
  /** Prêmio próprio do comprador, em US¢/bu. */
  premioCentavosBu: number
}

export interface TradingResultado extends TradingInput {
  usdPorSaca: number
  brlPorSacaPorto: number
  brlPorSacaFobOrigem: number
}

/**
 * Avalia uma lista de tradings/compradores, cada um com seu prêmio próprio,
 * mantendo CBOT, FOBBINGS, câmbio e frete fixos. Ordena do maior para o menor
 * preço FOB origem — "quem paga mais hoje".
 */
export function simularTradings(
  base: Omit<SimuladorInput, 'premioCentavosBu'>,
  tradings: TradingInput[],
): TradingResultado[] {
  return tradings
    .map((t) => {
      const r = simularPrecoGrao({ ...base, premioCentavosBu: t.premioCentavosBu })
      return {
        ...t,
        usdPorSaca: r.usdPorSaca,
        brlPorSacaPorto: r.brlPorSacaPorto,
        brlPorSacaFobOrigem: r.brlPorSacaFobOrigem,
      }
    })
    .sort((a, b) => b.brlPorSacaFobOrigem - a.brlPorSacaFobOrigem)
}

/** Praça/cidade com seu frete rodoviário até o porto (R$/saca). */
export interface PracaInput {
  nome: string
  /** Frete da praça até o porto, em R$/saca de 60 kg. */
  fretePorSacaBrl: number
}

export interface PracaResultado extends PracaInput {
  brlPorSacaFobOrigem: number
}

/**
 * Avalia o preço FOB origem (porteira) para várias praças, cada uma com seu
 * frete, mantendo CBOT/prêmio/FOBBINGS/câmbio fixos.
 */
export function simularPracas(
  base: Omit<SimuladorInput, 'fretePorSacaBrl'>,
  pracas: PracaInput[],
): PracaResultado[] {
  return pracas
    .map((p) => {
      const r = simularPrecoGrao({ ...base, fretePorSacaBrl: p.fretePorSacaBrl })
      return { ...p, brlPorSacaFobOrigem: r.brlPorSacaFobOrigem }
    })
    .sort((a, b) => b.brlPorSacaFobOrigem - a.brlPorSacaFobOrigem)
}

/** Input zerado padrão para o grão informado. */
export function simuladorVazio(grao: GraoSimulador = 'soja'): SimuladorInput {
  return {
    grao,
    cbotCentavosBu: 0,
    premioCentavosBu: 0,
    fobbingsUsdTon: -10,
    cambioUsdBrl: 0,
    fretePorSacaBrl: 0,
  }
}
