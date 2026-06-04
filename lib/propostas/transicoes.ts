/**
 * Máquina de estados de Proposta — regras de transição manual.
 *
 * Operador pode mudar status pelo painel de gestão, mas só pra estados
 * válidos a partir do atual. Algumas transições têm regras adicionais
 * (ex: PERDIDA exige lossReason).
 */

import { PROPOSTA_STATUS, type PropostaStatus } from './status'

/**
 * Mapa: status atual → lista de status de destino legais.
 *
 * Não inclui transições automáticas (cron de expiração, cliente aceita
 * no portal) — só o que operador pode fazer manualmente.
 */
export const TRANSICOES_LEGAIS: Record<string, PropostaStatus[]> = {
  [PROPOSTA_STATUS.RASCUNHO]: [
    PROPOSTA_STATUS.ENVIADA,
    PROPOSTA_STATUS.PERDIDA,
    PROPOSTA_STATUS.CANCELADA,
  ],
  [PROPOSTA_STATUS.AGUARDANDO_AUTORIZACAO]: [
    PROPOSTA_STATUS.ENVIADA,
    PROPOSTA_STATUS.CANCELADA,
  ],
  [PROPOSTA_STATUS.PENDENTE_APROVACAO]: [
    PROPOSTA_STATUS.PRONTA_PARA_ENVIAR,
    PROPOSTA_STATUS.CANCELADA,
  ],
  [PROPOSTA_STATUS.PRONTA_PARA_ENVIAR]: [
    PROPOSTA_STATUS.ENVIADA,
    PROPOSTA_STATUS.CANCELADA,
  ],
  [PROPOSTA_STATUS.ENVIADA]: [
    PROPOSTA_STATUS.EM_NEGOCIACAO,
    PROPOSTA_STATUS.ACEITA,
    PROPOSTA_STATUS.RECUSADA,
    PROPOSTA_STATUS.PERDIDA,
  ],
  [PROPOSTA_STATUS.EM_NEGOCIACAO]: [
    PROPOSTA_STATUS.ENVIADA, // voltar a enviada se cliente quer mais tempo
    PROPOSTA_STATUS.ACEITA,
    PROPOSTA_STATUS.RECUSADA,
    PROPOSTA_STATUS.PERDIDA,
  ],
  // Estados finais aceitos têm transição limitada (mover para sucesso final)
  [PROPOSTA_STATUS.ACEITA]: [PROPOSTA_STATUS.SUCESSO, PROPOSTA_STATUS.FECHADO],
  [PROPOSTA_STATUS.APROVADA]: [PROPOSTA_STATUS.SUCESSO, PROPOSTA_STATUS.FECHADO],
  // Estados finais perdidos = sem transição manual (somente recriar via clonar)
  [PROPOSTA_STATUS.PERDIDA]: [],
  [PROPOSTA_STATUS.RECUSADA]: [],
  [PROPOSTA_STATUS.REJEITADA]: [],
  [PROPOSTA_STATUS.CANCELADA]: [],
  [PROPOSTA_STATUS.EXPIRADA]: [],
  [PROPOSTA_STATUS.SUCESSO]: [],
  [PROPOSTA_STATUS.FECHADO]: [],
  [PROPOSTA_STATUS.CONCLUIDO]: [],
  [PROPOSTA_STATUS.FATURADO]: [],
}

/** Lista de destinos válidos para status atual. */
export function destinosValidos(statusAtual: string): PropostaStatus[] {
  return TRANSICOES_LEGAIS[statusAtual.toLowerCase()] ?? []
}

export interface ValidarTransicaoResult {
  ok: boolean
  motivo?: string
}

/**
 * Valida uma transição de A → B.
 *
 * @param statusAtual status atual
 * @param statusDestino destino desejado
 * @param ctx opcional: lossReason (necessário pra PERDIDA), etc.
 */
export function validarTransicao(
  statusAtual: string,
  statusDestino: string,
  ctx: { lossReason?: string | null } = {},
): ValidarTransicaoResult {
  const atual = statusAtual.toLowerCase()
  const destino = statusDestino.toLowerCase()

  if (atual === destino) {
    return { ok: false, motivo: 'Status atual já é o destino' }
  }

  const validos = destinosValidos(atual)
  if (!validos.includes(destino as PropostaStatus)) {
    return {
      ok: false,
      motivo: `Transição '${atual}' → '${destino}' não permitida. Válidos: ${validos.join(', ') || '(nenhum)'}`,
    }
  }

  // Regras condicionais
  if (destino === PROPOSTA_STATUS.PERDIDA && !ctx.lossReason) {
    return { ok: false, motivo: 'Marcar como PERDIDA exige lossReason' }
  }

  return { ok: true }
}

/**
 * Lista de lossReason válidos (espelha o endpoint /marcar-perdida).
 */
export const LOSS_REASONS = [
  'preco',
  'concorrencia',
  'prazo',
  'qualidade',
  'logistica',
  'sem_resposta',
  'outro',
] as const

export type LossReason = (typeof LOSS_REASONS)[number]
