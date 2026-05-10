/**
 * @deprecated Use `lib/whatsapp/evolution.ts` directly. This module is kept
 * apenas como compat shim — não tem mais consumers ativos no app (Sem 4.15
 * removeu o último em `app/api/propostas/[id]/send-whatsapp/route.ts`).
 *
 * Legacy WhatsApp Service — façade over the Evolution API client.
 *
 * The original implementation used `baileys` running locally with auth files
 * persisted on disk. We migrated to Evolution API v2 (multi-tenant, REST,
 * Railway-hosted). New code should import from `lib/whatsapp/evolution`.
 */

import {
  ensureInstance,
  getConnectionState,
  getQRCode as evoGetQRCode,
  logout as evoLogout,
  sendText as evoSendText,
} from './whatsapp/evolution'

let warned = false
function warnLegacy(fn: string) {
  if (!warned) {
    warned = true
    console.warn(
      `[whatsapp-service] ${fn}() chamado via shim legado — migrar para lib/whatsapp/evolution`
    )
  }
}

/**
 * No-op for backward compatibility. The Evolution API manages the WhatsApp
 * session server-side; we just ensure the instance exists.
 */
export async function initializeWhatsApp() {
  warnLegacy('initializeWhatsApp')
  await ensureInstance()
  return null
}

export async function getWhatsAppStatus(): Promise<{
  connected: boolean
  phone?: string
  qrAvailable: boolean
}> {
  warnLegacy('getWhatsAppStatus')
  try {
    const state = await getConnectionState()
    return {
      connected: state.status === 'open',
      phone: state.ownerJid?.split('@')[0],
      qrAvailable: state.status !== 'open',
    }
  } catch {
    return { connected: false, qrAvailable: false }
  }
}

export async function getQRCode(): Promise<string | null> {
  warnLegacy('getQRCode')
  try {
    const r = await evoGetQRCode()
    return r.base64
  } catch {
    return null
  }
}

export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  warnLegacy('sendWhatsAppMessage')
  try {
    const r = await evoSendText(phoneNumber, message)
    return { success: true, messageId: r.messageId }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

export async function sendTemplateMessage(
  phoneNumber: string,
  templateName: string,
  templateVars: Record<string, string>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  warnLegacy('sendTemplateMessage')
  const templates: Record<string, (vars: Record<string, string>) => string> = {
    proposal_sent: (v) => `🎉 *Olá ${v.clienteName}!*

Sua proposta #${v.proposalNumber} foi enviada com sucesso!

📊 *Resumo:*
• Tipo: ${v.type}
• Valor: ${v.value}
• Validade: ${v.validity}

_PHB Grain · Trading de Grãos_`,
    contract_created: (v) => `✅ *Contrato Criado!*

O contrato #${v.contractNumber} foi criado com base na proposta #${v.proposalNumber}.

_PHB Grain · Trading de Grãos_`,
    invoice_generated: (v) => `💰 *Boleto Gerado!*

Seu boleto #${v.invoiceNumber} está pronto para pagamento.
📅 Vencimento: ${v.dueDate}
💵 Valor: ${v.amount}

_PHB Grain · Trading de Grãos_`,
  }
  const tpl = templates[templateName]
  if (!tpl) {
    return { success: false, error: `Template "${templateName}" não encontrado` }
  }
  return sendWhatsAppMessage(phoneNumber, tpl(templateVars))
}

export async function logoutWhatsApp(): Promise<void> {
  warnLegacy('logoutWhatsApp')
  await evoLogout()
}

export async function testWhatsAppConnection(
  phoneNumber: string
): Promise<{ success: boolean; message: string }> {
  warnLegacy('testWhatsAppConnection')
  const r = await sendWhatsAppMessage(
    phoneNumber,
    '✅ Teste de conexão WhatsApp PHB Grain — Evolution API funcionando!'
  )
  return r.success
    ? { success: true, message: `✅ Mensagem enviada para ${phoneNumber}` }
    : { success: false, message: `❌ Erro: ${r.error}` }
}
