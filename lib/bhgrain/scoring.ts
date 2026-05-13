/**
 * BH Grain — Score de fechamento de proposta (função pura).
 *
 * Score 0-100 baseado em fatores ponderados. Sem I/O, totalmente determinístico.
 * Inputs são valores já carregados; quem chama é responsável por hidratar.
 */

export interface ScoreInput {
  clienteRecorrente: boolean
  clienteTaxaSucessoHistorica: number | null // 0..1
  ticketMedioCliente: number | null
  precoProposta: number
  precoMercadoAtual: number | null
  margemPercent: number | null // 0..100
  margemMinima: number | null // 0..100
  diasSemContato: number | null
  statusProposta: string
  validadeCotacaoRestanteMin: number | null
}

export type ScoreLabel = 'alta' | 'media' | 'baixa' | 'risco'

export interface ScoreResult {
  score: number // 0..100
  label: ScoreLabel
  fatoresPositivos: string[]
  fatoresNegativos: string[]
}

export function calcularScore(input: ScoreInput): ScoreResult {
  const positivos: string[] = []
  const negativos: string[] = []
  let s = 50

  if (input.clienteRecorrente) {
    s += 10
    positivos.push('Cliente recorrente')
  }
  if (input.clienteTaxaSucessoHistorica != null) {
    const delta = Math.round((input.clienteTaxaSucessoHistorica - 0.5) * 30)
    s += delta
    if (delta > 0) positivos.push(`Histórico positivo (${Math.round(input.clienteTaxaSucessoHistorica * 100)}% sucesso)`)
    else if (delta < 0) negativos.push('Histórico de recusa')
  }

  if (input.precoMercadoAtual != null && input.precoMercadoAtual > 0) {
    const diff = (input.precoProposta - input.precoMercadoAtual) / input.precoMercadoAtual
    if (diff <= 0.01) {
      s += 10
      positivos.push('Preço competitivo')
    } else if (diff >= 0.05) {
      s -= 15
      negativos.push(`Preço ${(diff * 100).toFixed(1)}% acima do mercado`)
    } else if (diff >= 0.02) {
      s -= 5
      negativos.push('Preço levemente acima do mercado')
    }
  }

  if (input.margemPercent != null) {
    if (input.margemMinima != null && input.margemPercent < input.margemMinima) {
      s -= 10
      negativos.push(`Margem ${input.margemPercent.toFixed(2)}% abaixo do mínimo`)
    } else if (input.margemPercent >= 8) {
      s += 5
      positivos.push('Margem saudável')
    }
  }

  if (input.diasSemContato != null) {
    if (input.diasSemContato > 7) {
      s -= 10
      negativos.push(`${input.diasSemContato} dias sem contato`)
    } else if (input.diasSemContato <= 1) {
      s += 5
      positivos.push('Cliente em contato recente')
    }
  }

  if (input.statusProposta === 'em_negociacao' || input.statusProposta === 'em negociação') {
    s += 8
    positivos.push('Em negociação ativa')
  } else if (input.statusProposta === 'recusada') {
    s = Math.min(s, 10)
    negativos.push('Já recusada')
  }

  if (input.validadeCotacaoRestanteMin != null) {
    if (input.validadeCotacaoRestanteMin <= 0) {
      s -= 15
      negativos.push('Cotação vencida')
    } else if (input.validadeCotacaoRestanteMin < 15) {
      negativos.push(`Cotação vence em ${input.validadeCotacaoRestanteMin} min`)
    }
  }

  s = Math.max(0, Math.min(100, Math.round(s)))

  const label: ScoreLabel =
    s >= 75 ? 'alta' : s >= 50 ? 'media' : s >= 30 ? 'baixa' : 'risco'

  return { score: s, label, fatoresPositivos: positivos, fatoresNegativos: negativos }
}
