/**
 * VaR (Value-at-Risk) — 3 métodos: paramétrico, histórico, Monte Carlo.
 *
 * Convenções:
 *  - Retornos diários log: r_t = ln(P_t / P_{t-1})
 *  - Confiança default: 95% (alpha = 0.05), horizonte: 1 dia
 *  - VaR é reportado como VALOR POSITIVO em USD (perda máxima esperada).
 *  - Long sofre com queda de preço; short sofre com alta.
 *  - Câmbio é tratado como fator de risco adicional aplicado proporcionalmente
 *    sobre o notional (efeito em BRL).
 */

import { z } from 'zod'

export type Cultura = 'soja' | 'milho' | 'trigo'

export interface PosicaoVaR {
  valorAtualUSD: number
  cultura: Cultura
  tipo: 'long' | 'short'
}

export interface HistoricoPonto {
  data: Date
  soja?: number
  milho?: number
  trigo?: number
  cambio?: number
}

export interface VaRInput {
  posicoes: PosicaoVaR[]
  cambioAtualUsdBrl: number
  historico: HistoricoPonto[]
  /** 0.95 ou 0.99 — default 0.95 */
  confianca?: number
  /** horizonte em dias — default 1 */
  horizonte?: number
}

export interface VaRResultado {
  metodo: 'parametrico' | 'historico' | 'monte_carlo'
  varUSD: number
  varBRL: number
  confianca: number
  horizonte: number
  populacao: number
  exposicaoTotalUSD: number
  exposicaoTotalBRL: number
  detalhes?: Record<string, any>
}

// ---------- helpers ----------

function zScore(confianca: number): number {
  // Inversa aproximada da normal padrão para 0.90/0.95/0.99
  // (Acklam approximation simplificada para os valores comuns)
  const alpha = 1 - confianca
  const table: Record<string, number> = {
    '0.10': 1.2816,
    '0.05': 1.6449,
    '0.025': 1.96,
    '0.01': 2.3263,
    '0.005': 2.5758,
  }
  const key = alpha.toFixed(3).replace(/0+$/, '').replace(/\.$/, '.0')
  // fallback: bisection na CDF normal
  if (table[alpha.toFixed(2)]) return table[alpha.toFixed(2)]
  return invNormCdf(1 - alpha)
}

function erf(x: number): number {
  // Abramowitz & Stegun 7.1.26
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + p * ax)
  const y =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax)
  return sign * y
}

function normCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}

function invNormCdf(p: number): number {
  // Bisection
  let lo = -10
  let hi = 10
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (normCdf(mid) < p) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

function logReturns(serie: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < serie.length; i++) {
    if (serie[i - 1] > 0 && serie[i] > 0) {
      out.push(Math.log(serie[i] / serie[i - 1]))
    }
  }
  return out
}

function media(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function desvioPadrao(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = media(arr)
  const v = arr.reduce((acc, x) => acc + (x - m) * (x - m), 0) / (arr.length - 1)
  return Math.sqrt(v)
}

function percentil(arr: number[], p: number): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.max(0, Math.min(sorted.length - 1, p * (sorted.length - 1)))
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  const w = idx - lo
  return sorted[lo] * (1 - w) + sorted[hi] * w
}

function extrairSerie(
  historico: HistoricoPonto[],
  campo: 'soja' | 'milho' | 'trigo' | 'cambio',
): number[] {
  return historico
    .map((h) => h[campo])
    .filter((v): v is number => typeof v === 'number' && v > 0)
}

function expoSinalSobreCultura(
  posicoes: PosicaoVaR[],
): Record<Cultura, number> {
  const out: Record<Cultura, number> = { soja: 0, milho: 0, trigo: 0 }
  for (const p of posicoes) {
    const sinal = p.tipo === 'long' ? 1 : -1
    out[p.cultura] += sinal * p.valorAtualUSD
  }
  return out
}

function exposicaoBrutaUSD(posicoes: PosicaoVaR[]): number {
  return posicoes.reduce((s, p) => s + Math.abs(p.valorAtualUSD), 0)
}

// ---------- Paramétrico ----------

export function varParametrico(input: VaRInput): VaRResultado {
  const conf = input.confianca ?? 0.95
  const h = input.horizonte ?? 1
  const z = zScore(conf)

  const expoCultura = expoSinalSobreCultura(input.posicoes)
  let varianciaCombinada = 0
  let detalhes: Record<string, any> = {}

  for (const cult of ['soja', 'milho', 'trigo'] as Cultura[]) {
    const expo = expoCultura[cult]
    if (expo === 0) continue
    const ret = logReturns(extrairSerie(input.historico, cult))
    const sigma = desvioPadrao(ret)
    varianciaCombinada += (sigma * expo) ** 2
    detalhes[cult] = { sigma, expo }
  }

  // Câmbio (fator BRL)
  const retCambio = logReturns(extrairSerie(input.historico, 'cambio'))
  const sigmaCambio = desvioPadrao(retCambio)
  detalhes.cambio = { sigma: sigmaCambio }

  const sigmaCarteira = Math.sqrt(varianciaCombinada)
  const varUSD = z * sigmaCarteira * Math.sqrt(h)

  // VaR em BRL: aplica câmbio + add fator cambial sobre exposição bruta
  const exposicaoBruta = exposicaoBrutaUSD(input.posicoes)
  const varCambialBRL =
    z * sigmaCambio * exposicaoBruta * input.cambioAtualUsdBrl * Math.sqrt(h)
  const varBRL = varUSD * input.cambioAtualUsdBrl + varCambialBRL

  return {
    metodo: 'parametrico',
    varUSD,
    varBRL,
    confianca: conf,
    horizonte: h,
    populacao: input.historico.length,
    exposicaoTotalUSD: exposicaoBruta,
    exposicaoTotalBRL: exposicaoBruta * input.cambioAtualUsdBrl,
    detalhes,
  }
}

// ---------- Histórico ----------

export function varHistorico(input: VaRInput): VaRResultado {
  const conf = input.confianca ?? 0.95
  const h = input.horizonte ?? 1
  const expoCultura = expoSinalSobreCultura(input.posicoes)

  // Para cada dia, calcula P&L combinado da carteira
  const series: Record<Cultura, number[]> = {
    soja: logReturns(extrairSerie(input.historico, 'soja')),
    milho: logReturns(extrairSerie(input.historico, 'milho')),
    trigo: logReturns(extrairSerie(input.historico, 'trigo')),
  }
  const retCambio = logReturns(extrairSerie(input.historico, 'cambio'))
  const n = Math.min(
    series.soja.length || Infinity,
    series.milho.length || Infinity,
    series.trigo.length || Infinity,
    retCambio.length || Infinity,
  )
  const tamanho = isFinite(n) ? n : Math.max(series.soja.length, series.milho.length, series.trigo.length, retCambio.length)

  const pnlSerie: number[] = []
  for (let i = 0; i < tamanho; i++) {
    let pnl = 0
    for (const cult of ['soja', 'milho', 'trigo'] as Cultura[]) {
      const r = series[cult][i]
      if (typeof r === 'number') pnl += r * expoCultura[cult]
    }
    pnlSerie.push(pnl)
  }

  const varDiario = -percentil(pnlSerie, 1 - conf)
  const varUSD = Math.max(0, varDiario) * Math.sqrt(h)

  const exposicaoBruta = exposicaoBrutaUSD(input.posicoes)
  const sigmaCambio = desvioPadrao(retCambio)
  const z = zScore(conf)
  const varCambialBRL =
    z * sigmaCambio * exposicaoBruta * input.cambioAtualUsdBrl * Math.sqrt(h)
  const varBRL = varUSD * input.cambioAtualUsdBrl + varCambialBRL

  return {
    metodo: 'historico',
    varUSD,
    varBRL,
    confianca: conf,
    horizonte: h,
    populacao: pnlSerie.length,
    exposicaoTotalUSD: exposicaoBruta,
    exposicaoTotalBRL: exposicaoBruta * input.cambioAtualUsdBrl,
    detalhes: { pnlSerieSize: pnlSerie.length },
  }
}

// ---------- Monte Carlo ----------

function randomNormal(): number {
  // Box-Muller
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function varMonteCarlo(
  input: VaRInput,
  simulacoes = 1000,
): VaRResultado {
  const conf = input.confianca ?? 0.95
  const h = input.horizonte ?? 1
  const expoCultura = expoSinalSobreCultura(input.posicoes)

  const sigmas: Record<Cultura, number> = {
    soja: desvioPadrao(logReturns(extrairSerie(input.historico, 'soja'))),
    milho: desvioPadrao(logReturns(extrairSerie(input.historico, 'milho'))),
    trigo: desvioPadrao(logReturns(extrairSerie(input.historico, 'trigo'))),
  }
  const sigmaCambio = desvioPadrao(logReturns(extrairSerie(input.historico, 'cambio')))

  const pnlSim: number[] = []
  for (let s = 0; s < simulacoes; s++) {
    let pnl = 0
    for (const cult of ['soja', 'milho', 'trigo'] as Cultura[]) {
      const expo = expoCultura[cult]
      if (expo === 0) continue
      const r = randomNormal() * sigmas[cult] * Math.sqrt(h)
      pnl += r * expo
    }
    pnlSim.push(pnl)
  }

  const varDiario = -percentil(pnlSim, 1 - conf)
  const varUSD = Math.max(0, varDiario)

  const exposicaoBruta = exposicaoBrutaUSD(input.posicoes)
  const z = zScore(conf)
  const varCambialBRL =
    z * sigmaCambio * exposicaoBruta * input.cambioAtualUsdBrl * Math.sqrt(h)
  const varBRL = varUSD * input.cambioAtualUsdBrl + varCambialBRL

  return {
    metodo: 'monte_carlo',
    varUSD,
    varBRL,
    confianca: conf,
    horizonte: h,
    populacao: simulacoes,
    exposicaoTotalUSD: exposicaoBruta,
    exposicaoTotalBRL: exposicaoBruta * input.cambioAtualUsdBrl,
    detalhes: { simulacoes, sigmas },
  }
}

// ---------- Stress test ----------

export interface ChoqueStress {
  cultura: Cultura | 'cambio'
  pct: number // ex -0.10 = queda 10%
}

export interface StressResultado {
  pnlUSD: number
  pnlBRL: number
  detalhes: Record<string, number>
}

export function stressTest(
  input: VaRInput,
  choques: ChoqueStress[],
): StressResultado {
  const expoCultura = expoSinalSobreCultura(input.posicoes)
  const exposicaoBruta = exposicaoBrutaUSD(input.posicoes)
  const detalhes: Record<string, number> = {}

  let pnlUSD = 0
  let choqueCambio = 0
  for (const c of choques) {
    if (c.cultura === 'cambio') {
      choqueCambio = c.pct
      continue
    }
    const expo = expoCultura[c.cultura]
    const efeito = c.pct * expo
    pnlUSD += efeito
    detalhes[c.cultura] = efeito
  }

  // efeito cambial: choque aplicado ao notional convertido em BRL
  const pnlCambialBRL =
    choqueCambio * exposicaoBruta * input.cambioAtualUsdBrl
  detalhes.cambio_brl = pnlCambialBRL

  const pnlBRL = pnlUSD * input.cambioAtualUsdBrl + pnlCambialBRL
  return { pnlUSD, pnlBRL, detalhes }
}

// ---------- Schemas ----------

export const VaRInputSchema = z.object({
  posicoes: z
    .array(
      z.object({
        valorAtualUSD: z.number(),
        cultura: z.enum(['soja', 'milho', 'trigo']),
        tipo: z.enum(['long', 'short']),
      }),
    )
    .min(1),
  cambioAtualUsdBrl: z.number().positive(),
  historico: z
    .array(
      z.object({
        data: z.coerce.date(),
        soja: z.number().positive().optional(),
        milho: z.number().positive().optional(),
        trigo: z.number().positive().optional(),
        cambio: z.number().positive().optional(),
      }),
    )
    .min(2),
  confianca: z.union([z.literal(0.95), z.literal(0.99)]).optional(),
  horizonte: z.number().int().positive().optional(),
})
