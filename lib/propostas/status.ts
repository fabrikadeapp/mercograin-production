/**
 * Status canônico de Proposta.
 *
 * Fonte ÚNICA da verdade. Use esta constante em vez de string literal.
 * Adicionar status novo aqui ANTES de usar em código novo.
 *
 * Inventário levantado em 2026-06-03: 168 string literals espalhados.
 * Esta lib não migra os existentes (compatibilidade), mas qualquer código
 * novo deve usar PROPOSTA_STATUS.* e helpers abaixo.
 */

export const PROPOSTA_STATUS = {
  RASCUNHO: 'rascunho',
  /** Rascunho gerado automaticamente pela IA/varredura — equivale a RASCUNHO
   *  para fins de fluxo (revisar → enviar). */
  RASCUNHO_IA: 'rascunho_ia',
  /** Aguarda visto do staff (proposta criada via canal WhatsApp/IA/telefone). */
  AGUARDANDO_AUTORIZACAO: 'aguardando_autorizacao',
  /** Aguarda decisão de aprovação multi-etapa (CommercialRule). */
  PENDENTE_APROVACAO: 'pendente_aprovacao',
  /** Aprovada internamente — aguarda envio ao cliente. */
  PRONTA_PARA_ENVIAR: 'pronta_para_enviar',
  ENVIADA: 'enviada',
  EM_NEGOCIACAO: 'em_negociacao',
  /** Cliente aceitou — gerou Contrato. */
  ACEITA: 'aceita',
  /** Sinônimo legado de ACEITA (banco tem ambos). */
  APROVADA: 'aprovada',
  /** Status finais — proposta fechou com sucesso (contrato cumprido). */
  SUCESSO: 'sucesso',
  FECHADO: 'fechado',
  CONCLUIDO: 'concluido',
  FATURADO: 'faturado',
  /** Cliente rejeitou no portal. */
  RECUSADA: 'recusada',
  /** Equipe interna marcou perdida com lossReason. */
  PERDIDA: 'perdida',
  REJEITADA: 'rejeitada',
  CANCELADA: 'cancelada',
  /** Vencida (cron de expiração). */
  EXPIRADA: 'expirada',
} as const

export type PropostaStatus = (typeof PROPOSTA_STATUS)[keyof typeof PROPOSTA_STATUS]

// ─────────────────────────────────────────────
// Grupos semânticos
// ─────────────────────────────────────────────

/** Status em que a proposta está "viva" e operável. */
export const STATUS_ABERTOS = new Set<string>([
  PROPOSTA_STATUS.RASCUNHO,
  PROPOSTA_STATUS.AGUARDANDO_AUTORIZACAO,
  PROPOSTA_STATUS.PENDENTE_APROVACAO,
  PROPOSTA_STATUS.PRONTA_PARA_ENVIAR,
  PROPOSTA_STATUS.ENVIADA,
  PROPOSTA_STATUS.EM_NEGOCIACAO,
])

/** Status que contam como ganho (geraram contrato/receita). */
export const STATUS_FECHADOS_SUCESSO = new Set<string>([
  PROPOSTA_STATUS.ACEITA,
  PROPOSTA_STATUS.APROVADA,
  PROPOSTA_STATUS.SUCESSO,
  PROPOSTA_STATUS.FECHADO,
  PROPOSTA_STATUS.CONCLUIDO,
  PROPOSTA_STATUS.FATURADO,
])

/** Status que contam como perda. */
export const STATUS_FECHADOS_PERDA = new Set<string>([
  PROPOSTA_STATUS.RECUSADA,
  PROPOSTA_STATUS.REJEITADA,
  PROPOSTA_STATUS.PERDIDA,
  PROPOSTA_STATUS.CANCELADA,
  PROPOSTA_STATUS.EXPIRADA,
])

/** Status em que a proposta pode receber edição livre. */
export const STATUS_EDITAVEIS = new Set<string>([
  PROPOSTA_STATUS.RASCUNHO,
])

/** Status em que pode ser enviada para cliente. */
export const STATUS_ENVIAVEIS = new Set<string>([
  PROPOSTA_STATUS.RASCUNHO,
  PROPOSTA_STATUS.PRONTA_PARA_ENVIAR,
])

/** Status em que cliente pode aceitar/recusar no portal. */
export const STATUS_DECIDIVEIS_PORTAL = new Set<string>([
  PROPOSTA_STATUS.ENVIADA,
  PROPOSTA_STATUS.EM_NEGOCIACAO,
])

/** Status em que pode ser marcada como perdida pela equipe. */
export const STATUS_PODEM_PERDER = new Set<string>([
  PROPOSTA_STATUS.RASCUNHO,
  PROPOSTA_STATUS.ENVIADA,
  PROPOSTA_STATUS.EM_NEGOCIACAO,
  PROPOSTA_STATUS.PRONTA_PARA_ENVIAR,
])

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

export function isAberta(status: string): boolean {
  return STATUS_ABERTOS.has(status.toLowerCase())
}

export function isFechadaSucesso(status: string): boolean {
  return STATUS_FECHADOS_SUCESSO.has(status.toLowerCase())
}

export function isFechadaPerda(status: string): boolean {
  return STATUS_FECHADOS_PERDA.has(status.toLowerCase())
}

export function podeEditar(status: string): boolean {
  return STATUS_EDITAVEIS.has(status.toLowerCase())
}

export function podeEnviar(status: string): boolean {
  return STATUS_ENVIAVEIS.has(status.toLowerCase())
}

export function podeDecidirPortal(status: string): boolean {
  return STATUS_DECIDIVEIS_PORTAL.has(status.toLowerCase())
}

export function podeMarcarPerdida(status: string): boolean {
  return STATUS_PODEM_PERDER.has(status.toLowerCase())
}

// ─────────────────────────────────────────────
// Labels e cores para UI
// ─────────────────────────────────────────────

export const STATUS_LABEL: Record<string, string> = {
  [PROPOSTA_STATUS.RASCUNHO]: 'Rascunho',
  [PROPOSTA_STATUS.AGUARDANDO_AUTORIZACAO]: 'Aguardando autorização',
  [PROPOSTA_STATUS.PENDENTE_APROVACAO]: 'Pendente aprovação',
  [PROPOSTA_STATUS.PRONTA_PARA_ENVIAR]: 'Pronta para enviar',
  [PROPOSTA_STATUS.ENVIADA]: 'Enviada',
  [PROPOSTA_STATUS.EM_NEGOCIACAO]: 'Em negociação',
  [PROPOSTA_STATUS.ACEITA]: 'Aceita',
  [PROPOSTA_STATUS.APROVADA]: 'Aprovada',
  [PROPOSTA_STATUS.SUCESSO]: 'Sucesso',
  [PROPOSTA_STATUS.FECHADO]: 'Fechado',
  [PROPOSTA_STATUS.CONCLUIDO]: 'Concluído',
  [PROPOSTA_STATUS.FATURADO]: 'Faturado',
  [PROPOSTA_STATUS.RECUSADA]: 'Recusada',
  [PROPOSTA_STATUS.PERDIDA]: 'Perdida',
  [PROPOSTA_STATUS.REJEITADA]: 'Rejeitada',
  [PROPOSTA_STATUS.CANCELADA]: 'Cancelada',
  [PROPOSTA_STATUS.EXPIRADA]: 'Expirada',
}

/** Tom semântico para badges/chips. */
export function statusTom(status: string): 'pos' | 'neg' | 'warn' | 'info' | 'neutral' {
  const s = status.toLowerCase()
  if (STATUS_FECHADOS_SUCESSO.has(s)) return 'pos'
  if (STATUS_FECHADOS_PERDA.has(s)) return 'neg'
  if (s === PROPOSTA_STATUS.EM_NEGOCIACAO) return 'warn'
  if (s === PROPOSTA_STATUS.ENVIADA) return 'info'
  return 'neutral'
}
