/**
 * Classificação física de carga de grãos.
 *
 * Modelo de desconto: para cada ponto percentual da medida acima do padrão,
 * aplica-se um desconto de (fator * 1%) sobre o peso bruto.
 * Medidas abaixo do padrão NÃO geram ágio (apenas evitam desconto).
 * Medidas acima do MÁXIMO geram alerta (não rejeitam — corretora decide).
 * O desconto total é capeado em 30% por segurança.
 */

export type Cultura = 'soja' | 'milho' | 'trigo'

export interface MedidasClassificacao {
  umidade: number
  impureza: number
  ardidos?: number
  quebrados?: number
  esverdeados?: number
  pesoHectolitroKg?: number
  /** S7 M4 — soma genérica de avariados (mofados/manchados/picados etc.). */
  avariadosGeral?: number
}

export interface PadraoClassificacao {
  cultura: Cultura
  umidadePadrao: number
  umidadeMaxima: number
  impurezaPadrao: number
  impurezaMaxima: number
  ardidosMaximo: number
  quebradosMaximo: number
  esverdeadosMaximo?: number
  pesoHectolitroMin?: number
  fatorDescontoUmidade: number
  fatorDescontoImpureza: number
  fatorDescontoArdidos: number
  fatorDescontoQuebrados: number
  /** S7 M4 — fator default 1.5% por ponto percentual de avariados generic. */
  fatorDescontoAvariados?: number
}

export interface ResultadoClassificacao {
  descontoUmidadePct: number
  descontoImpurezaPct: number
  descontoArdidosPct: number
  descontoQuebradosPct: number
  descontoAvariadosPct: number
  descontoTotalPct: number
  pesoLiquidoFinalKg: number
  alertaForaPadrao: string[]
}

export const DESCONTO_TOTAL_MAX_PCT = 30

/** Padrões default por cultura (base Paranaguá / mercado Sul). */
export const PADROES_DEFAULT: Record<Cultura, Omit<PadraoClassificacao, 'cultura'>> = {
  soja: {
    umidadePadrao: 14,
    umidadeMaxima: 18,
    impurezaPadrao: 1,
    impurezaMaxima: 4,
    ardidosMaximo: 8,
    quebradosMaximo: 30,
    esverdeadosMaximo: 4,
    fatorDescontoUmidade: 1.2,
    fatorDescontoImpureza: 1.0,
    fatorDescontoArdidos: 2.0,
    fatorDescontoQuebrados: 0.5,
  },
  milho: {
    umidadePadrao: 14,
    umidadeMaxima: 18,
    impurezaPadrao: 1.5,
    impurezaMaxima: 5,
    ardidosMaximo: 6,
    quebradosMaximo: 5,
    fatorDescontoUmidade: 1.0,
    fatorDescontoImpureza: 1.0,
    fatorDescontoArdidos: 2.0,
    fatorDescontoQuebrados: 0.5,
  },
  trigo: {
    umidadePadrao: 13,
    umidadeMaxima: 16,
    impurezaPadrao: 1,
    impurezaMaxima: 3,
    ardidosMaximo: 4,
    quebradosMaximo: 2,
    pesoHectolitroMin: 78,
    fatorDescontoUmidade: 1.0,
    fatorDescontoImpureza: 1.5,
    fatorDescontoArdidos: 2.5,
    fatorDescontoQuebrados: 0.5,
  },
}

function descontoLinear(medida: number | undefined, padrao: number, fator: number): number {
  if (medida === undefined || medida === null || isNaN(medida)) return 0
  if (medida <= padrao) return 0
  const excesso = medida - padrao
  return Math.max(0, excesso * fator)
}

/**
 * Calcula classificação completa: descontos individuais, desconto total
 * (cap em 30%), peso líquido final e lista de alertas se medidas excedem o
 * MÁXIMO permitido.
 */
export function classificarCarga(
  medidas: MedidasClassificacao,
  padrao: PadraoClassificacao,
  pesoBrutoKg: number
): ResultadoClassificacao {
  if (!isFinite(pesoBrutoKg) || pesoBrutoKg < 0) {
    throw new Error('pesoBrutoKg deve ser número não-negativo')
  }

  const descontoUmidadePct = descontoLinear(
    medidas.umidade,
    padrao.umidadePadrao,
    padrao.fatorDescontoUmidade
  )
  const descontoImpurezaPct = descontoLinear(
    medidas.impureza,
    padrao.impurezaPadrao,
    padrao.fatorDescontoImpureza
  )
  // Ardidos e quebrados: padrão = 0 (qualquer presença reduz),
  // mas usamos só fator * medida quando há máximo definido.
  const descontoArdidosPct = descontoLinear(
    medidas.ardidos ?? 0,
    0,
    padrao.fatorDescontoArdidos
  )
  const descontoQuebradosPct = descontoLinear(
    medidas.quebrados ?? 0,
    0,
    padrao.fatorDescontoQuebrados
  )
  // S7 M4 — avariados generic: cada ponto percentual desconta fator (default 1.5%).
  const descontoAvariadosPct = descontoLinear(
    medidas.avariadosGeral ?? 0,
    0,
    padrao.fatorDescontoAvariados ?? 1.5
  )

  const somaPct =
    descontoUmidadePct +
    descontoImpurezaPct +
    descontoArdidosPct +
    descontoQuebradosPct +
    descontoAvariadosPct
  const descontoTotalPct = Math.min(somaPct, DESCONTO_TOTAL_MAX_PCT)

  const pesoLiquidoFinalKg = pesoBrutoKg * (1 - descontoTotalPct / 100)

  const alertaForaPadrao: string[] = []
  if (medidas.umidade > padrao.umidadeMaxima) {
    alertaForaPadrao.push(
      `umidade acima do máximo (${medidas.umidade}% > ${padrao.umidadeMaxima}%)`
    )
  }
  if (medidas.impureza > padrao.impurezaMaxima) {
    alertaForaPadrao.push(
      `impureza acima do máximo (${medidas.impureza}% > ${padrao.impurezaMaxima}%)`
    )
  }
  if ((medidas.ardidos ?? 0) > padrao.ardidosMaximo) {
    alertaForaPadrao.push(
      `ardidos acima do máximo (${medidas.ardidos}% > ${padrao.ardidosMaximo}%)`
    )
  }
  if ((medidas.quebrados ?? 0) > padrao.quebradosMaximo) {
    alertaForaPadrao.push(
      `quebrados acima do máximo (${medidas.quebrados}% > ${padrao.quebradosMaximo}%)`
    )
  }
  if (
    padrao.esverdeadosMaximo !== undefined &&
    medidas.esverdeados !== undefined &&
    medidas.esverdeados > padrao.esverdeadosMaximo
  ) {
    alertaForaPadrao.push(
      `esverdeados acima do máximo (${medidas.esverdeados}% > ${padrao.esverdeadosMaximo}%)`
    )
  }
  if (
    padrao.pesoHectolitroMin !== undefined &&
    medidas.pesoHectolitroKg !== undefined &&
    medidas.pesoHectolitroKg < padrao.pesoHectolitroMin
  ) {
    alertaForaPadrao.push(
      `peso hectolitro abaixo do mínimo (${medidas.pesoHectolitroKg}kg < ${padrao.pesoHectolitroMin}kg)`
    )
  }

  if (somaPct > DESCONTO_TOTAL_MAX_PCT) {
    alertaForaPadrao.push(
      `desconto total bruto ${somaPct.toFixed(2)}% capeado em ${DESCONTO_TOTAL_MAX_PCT}%`
    )
  }

  return {
    descontoUmidadePct: round2(descontoUmidadePct),
    descontoImpurezaPct: round2(descontoImpurezaPct),
    descontoArdidosPct: round2(descontoArdidosPct),
    descontoQuebradosPct: round2(descontoQuebradosPct),
    descontoAvariadosPct: round2(descontoAvariadosPct),
    descontoTotalPct: round2(descontoTotalPct),
    pesoLiquidoFinalKg: round2(pesoLiquidoFinalKg),
    alertaForaPadrao,
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Resolve padrão a partir de cultura + opcionalmente uma TabelaClassificacao do DB. */
export function padraoFromTabela(
  cultura: Cultura,
  tabela?: Partial<PadraoClassificacao> | null
): PadraoClassificacao {
  const base = PADROES_DEFAULT[cultura]
  return {
    cultura,
    ...base,
    ...(tabela || {}),
  }
}
