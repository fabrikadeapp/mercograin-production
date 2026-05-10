/**
 * Calculadora de tributos fiscais — agronegócio brasileiro.
 *
 * Cobre cenários típicos de corretora de grãos:
 *  - Compra de produtor PF (FUNRURAL 1.3%; ICMS diferido em algumas UFs)
 *  - Compra de produtor PJ
 *  - Venda intra-estadual (diferimento ICMS em RS/PR/MT/MS comum p/ grãos)
 *  - Venda inter-estadual (ICMS 7% Sul/Sudeste→N/NE/CO, 12% demais)
 *  - PIS/COFINS alíquota zero p/ soja/milho/trigo em natura (Lei 10.925/2004)
 *  - Regimes: Simples Nacional, Lucro Presumido, Lucro Real
 *
 * IMPORTANTE: cálculos conservadores (errar pra mais). Não substitui contador.
 * Para emissão real, provider (NFE.io etc.) recalcula com regra fiscal completa.
 */

export type Regime = 'simples_nacional' | 'lucro_presumido' | 'lucro_real' | 'mei'
export type TipoDestinatario = 'PF' | 'PJ'
export type RegimeDestinatario = 'simples' | 'normal'

export interface ItemNF {
  descricao: string
  ncm: string // NCM 8 dígitos
  cfop: string // 4 dígitos
  qtd: number
  unidade: string // 'KG' | 'TON' | 'SC' | 'UN'
  valorUnitario: number
  valorTotal: number // qtd * valorUnitario
  origemUF: string // 'RS', 'PR', ...
  destinoUF: string
  destinatarioTipo: TipoDestinatario
  destinatarioRegime?: RegimeDestinatario
  diferimentoICMS?: boolean
  // Operação típica de corretora
  operacao: 'compra_produtor' | 'venda_industria' | 'venda_exportacao' | 'devolucao' | 'transferencia'
}

export interface TributosCalculados {
  valorICMS: number
  valorICMSST: number
  valorPIS: number
  valorCOFINS: number
  valorFUNRURAL: number
  valorIRPF: number // retenção em compra de PF acima de R$ 6k/mês (placeholder)
  valorTotal: number
  // Detalhamento
  aliquotaICMS: number
  baseCalculoICMS: number
  aliquotaPIS: number
  aliquotaCOFINS: number
  observacoes: string[]
}

/**
 * Tabela ICMS interestadual (origem → destino).
 * Sul/Sudeste (exceto ES) → N/NE/CO/ES = 7%; demais = 12%.
 */
const UF_SUL_SUDESTE = new Set(['RS', 'SC', 'PR', 'SP', 'RJ', 'MG'])
const UF_N_NE_CO_ES = new Set([
  'AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO',
  'AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE',
  'DF', 'GO', 'MT', 'MS', 'ES',
])

export function aliquotaICMSInterestadual(origemUF: string, destinoUF: string): number {
  if (UF_SUL_SUDESTE.has(origemUF) && UF_N_NE_CO_ES.has(destinoUF)) return 0.07
  return 0.12
}

/**
 * Estados que tipicamente aplicam diferimento de ICMS em operação interna
 * com produto primário (soja/milho/trigo em natura).
 * Conservador: assume diferimento somente se item.diferimentoICMS=true
 * OU se a operação for compra de produtor (entrada do estabelecimento).
 */
const UF_DIFERIMENTO_GRAOS = new Set(['RS', 'PR', 'MT', 'MS', 'SC', 'GO'])

/**
 * NCMs típicos do agronegócio com PIS/COFINS alíquota zero
 * (Lei 10.925/2004 — produtos da cesta básica e agroindustriais).
 */
const NCM_ALIQUOTA_ZERO_PIS_COFINS = new Set([
  '12019000', // soja em grão
  '10059010', // milho em grão (semente)
  '10059090', // milho em grão (demais)
  '10011900', // trigo em grão
  '12060010', // girassol semente
  '12074000', // gergelim
])

export function calcularTributos(item: ItemNF, regime: Regime): TributosCalculados {
  const obs: string[] = []
  const base = item.valorTotal

  // ===== ICMS =====
  let aliquotaICMS = 0
  let valorICMS = 0
  const isInterestadual = item.origemUF !== item.destinoUF
  const aplicaDiferimento =
    item.diferimentoICMS === true ||
    (item.operacao === 'compra_produtor' &&
      UF_DIFERIMENTO_GRAOS.has(item.origemUF) &&
      !isInterestadual)

  if (aplicaDiferimento) {
    obs.push('ICMS diferido (operação interna com produto primário)')
    aliquotaICMS = 0
  } else if (item.operacao === 'venda_exportacao') {
    obs.push('ICMS isento (exportação — Lei Kandir)')
    aliquotaICMS = 0
  } else if (isInterestadual) {
    aliquotaICMS = aliquotaICMSInterestadual(item.origemUF, item.destinoUF)
    valorICMS = base * aliquotaICMS
    obs.push(`ICMS interestadual ${(aliquotaICMS * 100).toFixed(0)}% (${item.origemUF}→${item.destinoUF})`)
  } else {
    // Intra-estadual sem diferimento — usa alíquota interna média 17%
    aliquotaICMS = 0.17
    valorICMS = base * aliquotaICMS
    obs.push('ICMS interno 17% (conservador, varia por UF)')
  }

  // ===== PIS / COFINS =====
  let aliquotaPIS = 0
  let aliquotaCOFINS = 0
  let valorPIS = 0
  let valorCOFINS = 0

  const ncmLimpa = item.ncm.replace(/\D/g, '')
  const isProdutoPrimario = NCM_ALIQUOTA_ZERO_PIS_COFINS.has(ncmLimpa)

  if (isProdutoPrimario && item.operacao !== 'venda_industria') {
    obs.push('PIS/COFINS alíquota zero (Lei 10.925 — produto primário em natura)')
  } else if (regime === 'simples_nacional' || regime === 'mei') {
    // Simples engloba PIS/COFINS no DAS — não destacar no item
    obs.push('PIS/COFINS embutidos no DAS (Simples Nacional)')
  } else if (regime === 'lucro_presumido') {
    aliquotaPIS = 0.0065
    aliquotaCOFINS = 0.03
    valorPIS = base * aliquotaPIS
    valorCOFINS = base * aliquotaCOFINS
  } else if (regime === 'lucro_real') {
    aliquotaPIS = 0.0165
    aliquotaCOFINS = 0.076
    valorPIS = base * aliquotaPIS
    valorCOFINS = base * aliquotaCOFINS
  }

  // ===== FUNRURAL =====
  // Aplicado na COMPRA de produtor PESSOA FÍSICA (responsabilidade do adquirente).
  // Alíquota total 1.3% (1.2% INSS + 0.1% RAT) sobre valor bruto da compra.
  // Lei 10.256/2001 + EC 103/2019.
  let valorFUNRURAL = 0
  if (item.operacao === 'compra_produtor' && item.destinatarioTipo === 'PF') {
    valorFUNRURAL = base * 0.013
    obs.push('FUNRURAL 1.3% retido (compra de produtor PF)')
  }

  // ===== IRPF retenção (placeholder, real só acima R$ 6k/mês acumulado) =====
  const valorIRPF = 0

  // ===== ST (Substituição Tributária) — não típico p/ grãos em natura =====
  const valorICMSST = 0

  const valorTotal = base + valorICMS + valorICMSST + valorPIS + valorCOFINS - valorFUNRURAL - valorIRPF

  return {
    valorICMS: round2(valorICMS),
    valorICMSST: round2(valorICMSST),
    valorPIS: round2(valorPIS),
    valorCOFINS: round2(valorCOFINS),
    valorFUNRURAL: round2(valorFUNRURAL),
    valorIRPF: round2(valorIRPF),
    valorTotal: round2(valorTotal),
    aliquotaICMS,
    baseCalculoICMS: round2(base),
    aliquotaPIS,
    aliquotaCOFINS,
    observacoes: obs,
  }
}

/**
 * Agrega tributos de múltiplos itens.
 */
export function calcularTotaisNF(itens: ItemNF[], regime: Regime): TributosCalculados & { valorProdutos: number } {
  const acc: TributosCalculados & { valorProdutos: number } = {
    valorICMS: 0,
    valorICMSST: 0,
    valorPIS: 0,
    valorCOFINS: 0,
    valorFUNRURAL: 0,
    valorIRPF: 0,
    valorTotal: 0,
    aliquotaICMS: 0,
    baseCalculoICMS: 0,
    aliquotaPIS: 0,
    aliquotaCOFINS: 0,
    observacoes: [],
    valorProdutos: 0,
  }

  for (const item of itens) {
    const trib = calcularTributos(item, regime)
    acc.valorProdutos += item.valorTotal
    acc.valorICMS += trib.valorICMS
    acc.valorICMSST += trib.valorICMSST
    acc.valorPIS += trib.valorPIS
    acc.valorCOFINS += trib.valorCOFINS
    acc.valorFUNRURAL += trib.valorFUNRURAL
    acc.valorIRPF += trib.valorIRPF
    acc.valorTotal += trib.valorTotal
    acc.baseCalculoICMS += trib.baseCalculoICMS
    for (const o of trib.observacoes) {
      if (!acc.observacoes.includes(o)) acc.observacoes.push(o)
    }
  }

  // Arredondar agregados
  acc.valorProdutos = round2(acc.valorProdutos)
  acc.valorICMS = round2(acc.valorICMS)
  acc.valorICMSST = round2(acc.valorICMSST)
  acc.valorPIS = round2(acc.valorPIS)
  acc.valorCOFINS = round2(acc.valorCOFINS)
  acc.valorFUNRURAL = round2(acc.valorFUNRURAL)
  acc.valorIRPF = round2(acc.valorIRPF)
  acc.valorTotal = round2(acc.valorTotal)
  acc.baseCalculoICMS = round2(acc.baseCalculoICMS)
  return acc
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
