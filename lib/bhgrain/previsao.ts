/**
 * BH Grain — Previsão ponderada de receita (função pura).
 *
 * Para cada proposta: probabilidade = base por status + ajuste por score.
 * Soma valorTotal × probabilidade.
 */

export const PROBABILIDADE_POR_STATUS: Record<string, number> = {
  rascunho: 0,
  rascunho_ia: 0,
  'rascunho ia': 0,
  pendente: 0.1,
  pronta_para_enviar: 0.2,
  'pronta para enviar': 0.2,
  enviada: 0.3,
  em_negociacao: 0.6,
  'em negociação': 0.6,
  sucesso: 1,
  aceita: 1,
  recusada: 0,
  expirada: 0,
}

export interface PropostaProb {
  valorTotal: number
  status: string
  score: number | null // 0..100
}

export function probabilidade(p: PropostaProb): number {
  const base = PROBABILIDADE_POR_STATUS[p.status.toLowerCase()] ?? 0.1
  if (base === 0 || base === 1) return base
  if (p.score == null) return base

  // Ajuste: score 50 = neutro; cada 10 pts ≈ ±5pp, clamp ±20pp.
  const ajuste = Math.max(-0.2, Math.min(0.2, ((p.score - 50) / 10) * 0.05))
  return Math.max(0, Math.min(1, base + ajuste))
}

export function previsaoReceita(propostas: PropostaProb[]): {
  total: number
  ponderado: number
  porStatus: Record<string, { total: number; ponderado: number; count: number }>
} {
  let total = 0
  let ponderado = 0
  const porStatus: Record<string, { total: number; ponderado: number; count: number }> = {}

  for (const p of propostas) {
    const prob = probabilidade(p)
    total += p.valorTotal
    ponderado += p.valorTotal * prob
    const k = p.status.toLowerCase()
    const bucket = porStatus[k] ?? { total: 0, ponderado: 0, count: 0 }
    bucket.total += p.valorTotal
    bucket.ponderado += p.valorTotal * prob
    bucket.count += 1
    porStatus[k] = bucket
  }

  return { total: round2(total), ponderado: round2(ponderado), porStatus }
}

export interface SimuladorMetaInput {
  meta: number
  atingido: number
  diasUteisRestantes: number
  previsaoPonderada: number
}

export type RiscoMeta = 'no_ritmo' | 'atencao' | 'risco' | 'critico'

export function simularMeta(input: SimuladorMetaInput): {
  falta: number
  necessarioPorDia: number
  cobrePrevisao: boolean
  risco: RiscoMeta
} {
  const falta = Math.max(0, round2(input.meta - input.atingido))
  const necessarioPorDia = input.diasUteisRestantes > 0 ? round2(falta / input.diasUteisRestantes) : falta
  const cobrePrevisao = input.atingido + input.previsaoPonderada >= input.meta
  const proporcaoAtingida = input.meta > 0 ? input.atingido / input.meta : 0
  // Esperado pro-rata: assume mês de 21 dias úteis se diasRestantes=0
  const totalDias = Math.max(1, input.diasUteisRestantes + 1) + Math.max(0, 21 - input.diasUteisRestantes - 1)
  const decorrido = totalDias - input.diasUteisRestantes
  const esperado = totalDias > 0 ? decorrido / totalDias : 1
  const gap = proporcaoAtingida - esperado

  let risco: RiscoMeta = 'no_ritmo'
  if (gap < -0.2) risco = 'critico'
  else if (gap < -0.1) risco = 'risco'
  else if (gap < -0.03) risco = 'atencao'

  return { falta, necessarioPorDia, cobrePrevisao, risco }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
