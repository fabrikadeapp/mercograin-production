/**
 * Simulador tributário por UF — comparativo de carga tributária na operação
 * de grãos (soja, milho, café, trigo etc.) entre estados.
 *
 * Modelo simplificado (valores baseados em RICMS estaduais 2024-2025):
 *  - ICMS interno (operação intra-UF)
 *  - ICMS interestadual (4%, 7% ou 12% conforme origem/destino)
 *  - Diferimento agro (suspensão ICMS na saída produtor → indústria)
 *  - PIS/COFINS (regime cumulativo presumido OU não-cumulativo real)
 *  - IRPJ + CSLL (presumido vs real)
 *  - FUNRURAL 1,3% sobre receita bruta (PF/PJ rural)
 *
 * DISCLAIMER: aproximação para preview/decisão. Confirme com contador.
 */

export type UF =
  | 'AC' | 'AL' | 'AM' | 'AP' | 'BA' | 'CE' | 'DF' | 'ES' | 'GO' | 'MA'
  | 'MG' | 'MS' | 'MT' | 'PA' | 'PB' | 'PE' | 'PI' | 'PR' | 'RJ' | 'RN'
  | 'RO' | 'RR' | 'RS' | 'SC' | 'SE' | 'SP' | 'TO'

export type RegimeTributario = 'lucro_real' | 'lucro_presumido' | 'simples'

export type Cultura = 'soja' | 'milho' | 'cafe' | 'trigo' | 'algodao' | 'sorgo' | 'outro'

interface UFConfig {
  icmsInterno: number          // alíquota interna grãos (%)
  diferimentoSaida: boolean    // saída produtor → indústria com diferimento
  /** Reduções de base / créditos presumidos típicos para grãos (%). */
  creditoPresumidoGraos: number
}

/**
 * Tabela curada (resumo prático). Valores médios — verificar RICMS local.
 */
const UF_TABELA: Record<UF, UFConfig> = {
  AC: { icmsInterno: 19, diferimentoSaida: false, creditoPresumidoGraos: 0 },
  AL: { icmsInterno: 19, diferimentoSaida: false, creditoPresumidoGraos: 0 },
  AM: { icmsInterno: 20, diferimentoSaida: false, creditoPresumidoGraos: 0 },
  AP: { icmsInterno: 18, diferimentoSaida: false, creditoPresumidoGraos: 0 },
  BA: { icmsInterno: 19, diferimentoSaida: true,  creditoPresumidoGraos: 7 },
  CE: { icmsInterno: 20, diferimentoSaida: false, creditoPresumidoGraos: 0 },
  DF: { icmsInterno: 18, diferimentoSaida: false, creditoPresumidoGraos: 0 },
  ES: { icmsInterno: 17, diferimentoSaida: true,  creditoPresumidoGraos: 0 },
  GO: { icmsInterno: 17, diferimentoSaida: true,  creditoPresumidoGraos: 9 },
  MA: { icmsInterno: 22, diferimentoSaida: true,  creditoPresumidoGraos: 0 },
  MG: { icmsInterno: 18, diferimentoSaida: true,  creditoPresumidoGraos: 7 },
  MS: { icmsInterno: 17, diferimentoSaida: true,  creditoPresumidoGraos: 9 },
  MT: { icmsInterno: 17, diferimentoSaida: true,  creditoPresumidoGraos: 9 },
  PA: { icmsInterno: 19, diferimentoSaida: true,  creditoPresumidoGraos: 0 },
  PB: { icmsInterno: 18, diferimentoSaida: false, creditoPresumidoGraos: 0 },
  PE: { icmsInterno: 20, diferimentoSaida: false, creditoPresumidoGraos: 0 },
  PI: { icmsInterno: 21, diferimentoSaida: false, creditoPresumidoGraos: 0 },
  PR: { icmsInterno: 19, diferimentoSaida: true,  creditoPresumidoGraos: 7 },
  RJ: { icmsInterno: 22, diferimentoSaida: false, creditoPresumidoGraos: 0 },
  RN: { icmsInterno: 18, diferimentoSaida: false, creditoPresumidoGraos: 0 },
  RO: { icmsInterno: 19.5, diferimentoSaida: true, creditoPresumidoGraos: 0 },
  RR: { icmsInterno: 20, diferimentoSaida: false, creditoPresumidoGraos: 0 },
  RS: { icmsInterno: 17, diferimentoSaida: true,  creditoPresumidoGraos: 7 },
  SC: { icmsInterno: 17, diferimentoSaida: true,  creditoPresumidoGraos: 7 },
  SE: { icmsInterno: 19, diferimentoSaida: false, creditoPresumidoGraos: 0 },
  SP: { icmsInterno: 18, diferimentoSaida: true,  creditoPresumidoGraos: 7 },
  TO: { icmsInterno: 18, diferimentoSaida: true,  creditoPresumidoGraos: 0 },
}

/** Regiões para definir alíquota interestadual (CF/88 + Res. Senado 22/89). */
const REGIAO_SUL_SUDESTE: UF[] = ['ES', 'MG', 'PR', 'RJ', 'RS', 'SC', 'SP']

/** Alíquota interestadual de origem→destino (sem considerar DIFAL). */
function aliquotaInterestadual(origem: UF, destino: UF): number {
  if (origem === destino) {
    return UF_TABELA[origem].icmsInterno
  }
  const origemSulSE = REGIAO_SUL_SUDESTE.includes(origem)
  const destinoSulSE = REGIAO_SUL_SUDESTE.includes(destino)
  // Sul/SE → Sul/SE = 12%; Sul/SE → N/NE/CO/ES = 7%; demais = 12%.
  if (origemSulSE && destinoSulSE) return 12
  if (origemSulSE && !destinoSulSE) return 7
  return 12
}

export interface SimulacaoInput {
  origemUF: UF
  destinoUF: UF
  cultura: Cultura
  valorTotal: number
  regime: RegimeTributario
  destinatarioTipo: 'PF' | 'PJ'
  /** Aplicar FUNRURAL 1,3% sobre receita bruta (default true para PF rural). */
  funrural?: boolean
}

export interface DecomposicaoTributaria {
  icms: { aliquota: number; base: number; valor: number; diferido: boolean; creditoPresumido: number }
  pis: { aliquota: number; valor: number }
  cofins: { aliquota: number; valor: number }
  irpj: { aliquota: number; base: number; valor: number }
  csll: { aliquota: number; base: number; valor: number }
  funrural: { aliquota: number; valor: number }
  totalTributos: number
  valorLiquido: number
  cargaEfetiva: number // %
}

export interface ResultadoSimulacao {
  origem: DecomposicaoTributaria
  destino: DecomposicaoTributaria
  /** Cenário "operar na origem" vs "operar no destino". */
  economiaAbsoluta: number
  economiaPercentual: number
  recomendacao: string
}

function calcular(
  ufOperacao: UF,
  outraUF: UF,
  input: SimulacaoInput,
): DecomposicaoTributaria {
  const cfg = UF_TABELA[ufOperacao]
  const isInter = ufOperacao !== outraUF

  // ICMS
  const aliquotaICMS = isInter ? aliquotaInterestadual(ufOperacao, outraUF) : cfg.icmsInterno
  const diferido = cfg.diferimentoSaida && input.destinatarioTipo === 'PJ' && !isInter
  const baseICMS = input.valorTotal
  const icmsBruto = diferido ? 0 : (baseICMS * aliquotaICMS) / 100
  const creditoPresumido = (icmsBruto * cfg.creditoPresumidoGraos) / 100
  const icmsValor = Math.max(0, icmsBruto - creditoPresumido)

  // PIS/COFINS — regime
  let aliqPIS: number, aliqCOFINS: number
  if (input.regime === 'simples') {
    aliqPIS = 0
    aliqCOFINS = 0
  } else if (input.regime === 'lucro_presumido') {
    aliqPIS = 0.65
    aliqCOFINS = 3
  } else {
    aliqPIS = 1.65
    aliqCOFINS = 7.6
  }
  const pisValor = (input.valorTotal * aliqPIS) / 100
  const cofinsValor = (input.valorTotal * aliqCOFINS) / 100

  // IRPJ + CSLL
  let baseIRPJ: number, baseCSLL: number, aliqIRPJ: number, aliqCSLL: number
  if (input.regime === 'lucro_presumido') {
    // Comércio: presunção 8% IRPJ / 12% CSLL
    baseIRPJ = input.valorTotal * 0.08
    baseCSLL = input.valorTotal * 0.12
    aliqIRPJ = 15
    aliqCSLL = 9
  } else if (input.regime === 'lucro_real') {
    // Aproximação: margem 5% sobre receita
    baseIRPJ = input.valorTotal * 0.05
    baseCSLL = input.valorTotal * 0.05
    aliqIRPJ = 15
    aliqCSLL = 9
  } else {
    baseIRPJ = 0; baseCSLL = 0; aliqIRPJ = 0; aliqCSLL = 0
  }
  const irpjValor = (baseIRPJ * aliqIRPJ) / 100
  const csllValor = (baseCSLL * aliqCSLL) / 100

  // FUNRURAL
  const aplicarFunrural = input.funrural ?? (input.destinatarioTipo === 'PF')
  const aliqFunrural = aplicarFunrural ? 1.3 : 0
  const funruralValor = (input.valorTotal * aliqFunrural) / 100

  const total = icmsValor + pisValor + cofinsValor + irpjValor + csllValor + funruralValor

  return {
    icms: {
      aliquota: aliquotaICMS,
      base: baseICMS,
      valor: round2(icmsValor),
      diferido,
      creditoPresumido: round2(creditoPresumido),
    },
    pis: { aliquota: aliqPIS, valor: round2(pisValor) },
    cofins: { aliquota: aliqCOFINS, valor: round2(cofinsValor) },
    irpj: { aliquota: aliqIRPJ, base: round2(baseIRPJ), valor: round2(irpjValor) },
    csll: { aliquota: aliqCSLL, base: round2(baseCSLL), valor: round2(csllValor) },
    funrural: { aliquota: aliqFunrural, valor: round2(funruralValor) },
    totalTributos: round2(total),
    valorLiquido: round2(input.valorTotal - total),
    cargaEfetiva: round2((total / input.valorTotal) * 100),
  }
}

function round2(n: number): number {
  return Number(n.toFixed(2))
}

export function simularTributacao(input: SimulacaoInput): ResultadoSimulacao {
  if (input.valorTotal <= 0) throw new Error('Simulador: valorTotal deve ser > 0')

  const origem = calcular(input.origemUF, input.destinoUF, input)
  const destino = calcular(input.destinoUF, input.origemUF, input)

  const economiaAbsoluta = round2(destino.totalTributos - origem.totalTributos)
  const economiaPercentual = round2(
    destino.totalTributos === 0 ? 0 : (economiaAbsoluta / destino.totalTributos) * 100,
  )

  let recomendacao: string
  if (Math.abs(economiaAbsoluta) < 0.01) {
    recomendacao = `Carga equivalente em ${input.origemUF} e ${input.destinoUF}.`
  } else if (economiaAbsoluta > 0) {
    recomendacao = `Operar em ${input.origemUF} economiza R$ ${economiaAbsoluta.toFixed(2)} (${economiaPercentual.toFixed(2)}%) versus ${input.destinoUF}.`
  } else {
    recomendacao = `Operar em ${input.destinoUF} economiza R$ ${Math.abs(economiaAbsoluta).toFixed(2)} (${Math.abs(economiaPercentual).toFixed(2)}%) versus ${input.origemUF}.`
  }

  return { origem, destino, economiaAbsoluta, economiaPercentual, recomendacao }
}

export function listarUFs(): UF[] {
  return Object.keys(UF_TABELA) as UF[]
}

export function getUFConfig(uf: UF): UFConfig {
  return UF_TABELA[uf]
}
