/**
 * @deprecated Use `lib/whatsapp/evolution.ts:sendText` directly.
 *
 * Histórico: este módulo era a fila Bull (Redis) para envio assíncrono de
 * WhatsApp. Em produção (Railway sem Redis configurado), o `new Queue(...)` no
 * topo do arquivo quebrava o boot do bundle que importasse este arquivo.
 *
 * Sem 4.15 removeu o último consumer (app/api/propostas/[id]/send-whatsapp).
 * Mantemos o arquivo apenas pra evitar quebrar imports remanescentes (se
 * houver), mas TODA a lógica Bull/Redis foi removida — chamadas resultam em
 * erro explícito orientando para a migração.
 */

export type WhatsAppJobType =
  | 'send_message'
  | 'send_template'
  | 'send_proposal'
  | 'send_contract'

export interface WhatsAppMessage {
  type: WhatsAppJobType
  phoneNumber: string
  message?: string
  templateName?: string
  templateVars?: Record<string, string>
  proposalId?: string
  contractId?: string
  userId: string
}

const DEPRECATED =
  '[whatsapp-queue] Removido na Sem 4.15. Use lib/whatsapp/evolution.ts:sendText diretamente.'

export async function queueWhatsAppMessage(
  _messageData: WhatsAppMessage,
  _options?: { delay?: number; priority?: number }
): Promise<string> {
  throw new Error(DEPRECATED)
}

export async function queueProposalNotification(
  _phoneNumber: string,
  _proposalNumber: string,
  _clienteName: string,
  _proposalType: string,
  _value: string,
  _validity: string,
  _userId: string
): Promise<string> {
  throw new Error(DEPRECATED)
}

export async function queueContractNotification(
  _phoneNumber: string,
  _contractNumber: string,
  _proposalNumber: string,
  _userId: string
): Promise<string> {
  throw new Error(DEPRECATED)
}

export async function queueInvoiceNotification(
  _phoneNumber: string,
  _invoiceNumber: string,
  _dueDate: string,
  _amount: string,
  _userId: string
): Promise<string> {
  throw new Error(DEPRECATED)
}

export async function getQueueStats() {
  return null
}

export async function clearFailedJobs() {
  /* no-op */
}

export default null
