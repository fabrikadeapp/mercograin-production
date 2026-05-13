/**
 * BH Grain — Motor de "próxima melhor ação" (função pura, regras simples).
 *
 * Não usa IA — apenas regras determinísticas baseadas em estado da proposta.
 * IA pode sobrescrever depois no L8.
 */

export type AcaoTipo =
  | 'revisar_preco'
  | 'enviar_proposta'
  | 'follow_up'
  | 'solicitar_info'
  | 'aprovacao'
  | 'aguardar'
  | 'atualizar_cotacao'

export interface AcaoInput {
  status: string
  margemPercent: number | null
  margemMinima: number | null
  validadeCotacaoRestanteMin: number | null
  horasSemResposta: number | null
  precisaAprovacao: boolean
  dadosCompletos: boolean
}

export interface AcaoResult {
  acao: AcaoTipo
  motivo: string
}

export function proximaAcao(input: AcaoInput): AcaoResult {
  if (!input.dadosCompletos) {
    return {
      acao: 'solicitar_info',
      motivo: 'Faltam dados para montar proposta',
    }
  }

  if (input.validadeCotacaoRestanteMin != null && input.validadeCotacaoRestanteMin <= 0) {
    return {
      acao: 'atualizar_cotacao',
      motivo: 'Cotação vencida — atualize antes de enviar',
    }
  }

  if (
    input.margemPercent != null &&
    input.margemMinima != null &&
    input.margemPercent < input.margemMinima
  ) {
    return {
      acao: 'revisar_preco',
      motivo: `Margem ${input.margemPercent.toFixed(2)}% abaixo do mínimo ${input.margemMinima.toFixed(2)}%`,
    }
  }

  if (input.precisaAprovacao) {
    return {
      acao: 'aprovacao',
      motivo: 'Proposta exige aprovação antes do envio',
    }
  }

  const status = input.status.toLowerCase()

  if (status.startsWith('rascunho') || status === 'pronta_para_enviar' || status === 'pronta para enviar') {
    return { acao: 'enviar_proposta', motivo: 'Proposta pronta, revisar e enviar' }
  }

  if (status === 'enviada' || status === 'em_negociacao' || status === 'em negociação') {
    if (input.horasSemResposta != null && input.horasSemResposta >= 4) {
      return {
        acao: 'follow_up',
        motivo: `Sem resposta há ${input.horasSemResposta}h — fazer follow-up`,
      }
    }
    return { acao: 'aguardar', motivo: 'Aguardando resposta do cliente' }
  }

  return { acao: 'aguardar', motivo: 'Sem ação imediata necessária' }
}
