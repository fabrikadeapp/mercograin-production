/**
 * Sugestão determinística de preço para proposta nova.
 *
 * Combina:
 *   1. Preço de mercado atual (CBOT × USDBRL ou Cotacao interna)
 *   2. Margem default do workspace pra commodity
 *   3. Histórico de fechamentos do mesmo cliente+grão pra detectar
 *      "prêmio típico" que esse cliente paga acima/abaixo do mercado.
 *
 * Função pura, testável. Endpoint busca os dados e injeta.
 */

import type { Grao } from '@/lib/cotacoes/unidades'

export interface PropostaHistorica {
  /** R$/t no momento do fechamento. */
  precoBrlTon: number
  /** Snapshot do preço de mercado naquele momento (R$/t). null se não tivermos. */
  marketBrlTon: number | null
  /** Data do fechamento (atualizadaEm da proposta fechada). */
  data: Date
}

export interface InputSugestaoPreco {
  /** Commodity. */
  grao: Grao
  /** Mercado atual em R$/t (CBOT × USDBRL para soja/milho/trigo, Cotacao para outros). */
  mercadoBrlTon: number | null
  /** Fonte do mercado, p/ transparência. */
  fonteMercado: 'CBOT' | 'Cotacao' | 'indisponivel'
  /** Quando capturou. */
  capturadoEm: Date
  /** Margem default (0..1) do workspace pra commodity. Ex: 0.03 = 3%. */
  margemDefault: number | null
  /** Últimos fechamentos do cliente+grão (max 10). Já filtrados. */
  historicoCliente: PropostaHistorica[]
}

export interface BandaCliente {
  /** Quantos registros entraram no cálculo. */
  n: number
  /** Mediana dos prêmios (0.012 = +1.2% sobre mercado). */
  premioMedio: number
  /** Banda de preços do cliente em R$/t. */
  minBrlTon: number
  maxBrlTon: number
  medianaBrlTon: number
}

export interface OutputSugestaoPreco {
  precoMercadoBrlTon: number | null
  fonteMercado: 'CBOT' | 'Cotacao' | 'indisponivel'
  capturadoEm: string // ISO
  margemDefault: number | null
  /** Preço sugerido = mercado × (1 + margem) — pra venda padrão. null se sem mercado. */
  sugeridoBaseBrlTon: number | null
  /** Preço sugerido cliente = mercado × (1 + premioMedioCliente). null se sem mercado ou sem histórico. */
  sugeridoClienteBrlTon: number | null
  /** Banda histórica do cliente. null se sem histórico relevante. */
  bandaCliente: BandaCliente | null
  warnings: string[]
}

/**
 * Calcula sugestão de preço a partir dos insumos. Determinístico, sem efeitos.
 */
export function calcularSugestaoPreco(input: InputSugestaoPreco): OutputSugestaoPreco {
  const warnings: string[] = []

  // 1. Base = mercado + margem default
  let sugeridoBase: number | null = null
  if (input.mercadoBrlTon != null && input.mercadoBrlTon > 0) {
    if (input.margemDefault != null && input.margemDefault > 0) {
      sugeridoBase = input.mercadoBrlTon * (1 + input.margemDefault)
    } else {
      sugeridoBase = input.mercadoBrlTon
      warnings.push('Sem margem default configurada — sugerindo preço de mercado puro')
    }
  } else {
    warnings.push('Mercado indisponível — sugestão limitada ao histórico do cliente')
  }

  // 2. Banda do cliente a partir do histórico
  const banda = calcularBandaCliente(input.historicoCliente)
  let sugeridoCliente: number | null = null
  if (banda && input.mercadoBrlTon != null && input.mercadoBrlTon > 0) {
    sugeridoCliente = input.mercadoBrlTon * (1 + banda.premioMedio)
    // Se preço sugerido pelo cliente está MUITO abaixo do base (mais de 3%),
    // sinaliza pro operador.
    if (sugeridoBase != null && sugeridoCliente < sugeridoBase * 0.97) {
      warnings.push(
        `Esse cliente historicamente paga ${(banda.premioMedio * 100).toFixed(1)}% sobre o mercado — abaixo da margem default`
      )
    }
  } else if (input.mercadoBrlTon != null && !banda) {
    warnings.push('Sem histórico desse cliente nesse grão — usando margem padrão')
  }

  return {
    precoMercadoBrlTon: input.mercadoBrlTon,
    fonteMercado: input.fonteMercado,
    capturadoEm: input.capturadoEm.toISOString(),
    margemDefault: input.margemDefault,
    sugeridoBaseBrlTon: sugeridoBase,
    sugeridoClienteBrlTon: sugeridoCliente,
    bandaCliente: banda,
    warnings,
  }
}

/**
 * Verifica se um preço está dentro da banda histórica do cliente.
 * Retorna null se não tem banda; senão objeto com tipo de desvio.
 */
export function verificarPrecoNaBanda(
  precoBrlTon: number,
  banda: BandaCliente | null
): { status: 'dentro' | 'abaixo' | 'acima'; desvioPct: number } | null {
  if (!banda || banda.n < 2) return null
  if (precoBrlTon < banda.minBrlTon) {
    return {
      status: 'abaixo',
      desvioPct: (banda.minBrlTon - precoBrlTon) / banda.minBrlTon,
    }
  }
  if (precoBrlTon > banda.maxBrlTon) {
    return {
      status: 'acima',
      desvioPct: (precoBrlTon - banda.maxBrlTon) / banda.maxBrlTon,
    }
  }
  return { status: 'dentro', desvioPct: 0 }
}

// ─────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────

function calcularBandaCliente(historico: PropostaHistorica[]): BandaCliente | null {
  if (historico.length < 2) return null

  // Premio: comparar preço da proposta com mercado naquela data.
  // Se não tem mercado salvo, descartamos esse ponto pro cálculo do prêmio
  // mas mantemos pra banda de preço absoluto.
  const comPremio = historico.filter((h) => h.marketBrlTon != null && h.marketBrlTon > 0)
  const premios = comPremio.map((h) => (h.precoBrlTon - h.marketBrlTon!) / h.marketBrlTon!)

  const precos = historico.map((h) => h.precoBrlTon).sort((a, b) => a - b)
  const minBrlTon = precos[0]
  const maxBrlTon = precos[precos.length - 1]
  const medianaBrlTon = mediana(precos)
  const premioMedio = premios.length >= 2 ? mediana(premios) : 0

  return {
    n: historico.length,
    premioMedio,
    minBrlTon,
    maxBrlTon,
    medianaBrlTon,
  }
}

function mediana(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}
