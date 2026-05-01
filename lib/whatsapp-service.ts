/**
 * WhatsApp Service - Baileys integration for notifications
 * Emulates WhatsApp Web - No costs!
 *
 * Setup:
 * 1. Call /api/whatsapp/connect to generate QR code
 * 2. Scan QR with phone's WhatsApp
 * 3. Session stored in Redis
 * 4. Ready to send messages!
 */

import { DisconnectReason, Browsers, makeWASocket, useMultiFileAuthState } from 'baileys'
import { Boom } from '@hapi/boom'
import { redis } from './redis'
import path from 'path'
import fs from 'fs'

let sock: ReturnType<typeof makeWASocket> | null = null
let qrCode: string | null = null

const authDir = path.join(process.cwd(), '.data/whatsapp-auth')

/**
 * Ensure auth directory exists
 */
function ensureAuthDir() {
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }
}

/**
 * Initialize WhatsApp connection
 */
export async function initializeWhatsApp() {
  try {
    console.log('[WhatsApp] Inicializando conexão...')

    ensureAuthDir()

    const { state, saveCreds } = await useMultiFileAuthState(authDir)

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
    })

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      // QR Code generated
      if (qr) {
        console.log('[WhatsApp] QR Code gerado')
        qrCode = qr
        // Store in Redis for API access (1 minute expiry)
        await redis.setex('whatsapp-qr', 60, qr)
      }

      // Connected
      if (connection === 'open') {
        console.log('[WhatsApp] ✅ Conectado com sucesso!')
        qrCode = null
        await redis.del('whatsapp-qr')
        await redis.setex('whatsapp-status', 86400, 'connected') // 24 hours
      }

      // Disconnected
      if (connection === 'close') {
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut

        console.log(
          `[WhatsApp] Desconectado. Reconectar: ${shouldReconnect}`,
          lastDisconnect?.error
        )

        if (shouldReconnect) {
          setTimeout(() => {
            initializeWhatsApp()
          }, 3000)
        } else {
          console.log('[WhatsApp] Usuário fez logout')
          await redis.del('whatsapp-status')
        }
      }
    })

    // Handle credentials update
    sock.ev.on('creds.update', saveCreds)

    return sock
  } catch (error) {
    console.error('[WhatsApp] Erro ao inicializar:', error)
    throw error
  }
}

/**
 * Get WhatsApp connection status
 */
export async function getWhatsAppStatus(): Promise<{
  connected: boolean
  phone?: string
  qrAvailable: boolean
}> {
  try {
    const status = await redis.get('whatsapp-status')
    const qr = await redis.get('whatsapp-qr')

    if (!sock) {
      return { connected: false, qrAvailable: !!qr }
    }

    const phoneNumber = sock?.user?.id?.split(':')[0]

    return {
      connected: status === 'connected' && !!sock,
      phone: phoneNumber,
      qrAvailable: !!qr,
    }
  } catch (error) {
    console.error('[WhatsApp] Erro ao checar status:', error)
    return { connected: false, qrAvailable: false }
  }
}

/**
 * Get current QR code
 */
export async function getQRCode(): Promise<string | null> {
  return await redis.get('whatsapp-qr')
}

/**
 * Send message via WhatsApp
 * @param phoneNumber Format: "5511999999999" (country + area + number)
 * @param message Plain text message
 */
export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Check connection
    if (!sock) {
      return { success: false, error: 'WhatsApp não conectado' }
    }

    // Ensure phone format (remove +, spaces, dashes)
    const cleanPhone = phoneNumber.replace(/\D/g, '')

    // Format: number@s.whatsapp.net (for individual chats)
    const jid = `${cleanPhone}@s.whatsapp.net`

    // Send message
    const response = await sock.sendMessage(jid, { text: message })

    if (!response || !response.key) {
      throw new Error('Falha ao enviar mensagem (response vazio)')
    }

    console.log(`[WhatsApp] Mensagem enviada para ${cleanPhone}`)

    return {
      success: true,
      messageId: response.key.id || 'unknown',
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[WhatsApp] Erro ao enviar mensagem:`, errorMsg)
    return {
      success: false,
      error: errorMsg,
    }
  }
}

/**
 * Send template message (with formatting)
 */
export async function sendTemplateMessage(
  phoneNumber: string,
  templateName: string,
  templateVars: Record<string, string>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const templates: Record<string, (vars: Record<string, string>) => string> = {
    proposal_sent: (vars) => `
🎉 *Olá ${vars.clienteName}!*

Sua proposta #${vars.proposalNumber} foi enviada com sucesso!

📊 *Resumo:*
• Tipo: ${vars.type}
• Valor: ${vars.value}
• Validade: ${vars.validity}

👉 Acesse seu portal para revisar os detalhes da proposta.

Qualquer dúvida, estamos à disposição!

_MercoGrain_
    `.trim(),

    contract_created: (vars) => `
✅ *Contrato Criado!*

O contrato #${vars.contractNumber} foi criado com base na proposta #${vars.proposalNumber}.

📋 *Próximos passos:*
• Revisar termos
• Assinar digitalmente
• Confirmar entrega

📞 Contate-nos se tiver dúvidas!

_MercoGrain_
    `.trim(),

    invoice_generated: (vars) => `
💰 *Boleto Gerado!*

Seu boleto #${vars.invoiceNumber} está pronto para pagamento.

📅 Vencimento: ${vars.dueDate}
💵 Valor: ${vars.amount}

👉 Acesse seu portal para visualizar e pagar o boleto.

Obrigado!

_MercoGrain_
    `.trim(),
  }

  const template = templates[templateName]
  if (!template) {
    return {
      success: false,
      error: `Template "${templateName}" não encontrado`,
    }
  }

  const message = template(templateVars)
  return sendWhatsAppMessage(phoneNumber, message)
}

/**
 * Logout from WhatsApp
 */
export async function logoutWhatsApp(): Promise<void> {
  try {
    if (sock) {
      await sock.logout()
      sock = null
      qrCode = null
      await redis.del('whatsapp-status')
      await redis.del('whatsapp-qr')
      console.log('[WhatsApp] Logout realizado')
    }
  } catch (error) {
    console.error('[WhatsApp] Erro ao fazer logout:', error)
    throw error
  }
}

/**
 * Test connection by sending a message
 */
export async function testWhatsAppConnection(
  phoneNumber: string
): Promise<{ success: boolean; message: string }> {
  try {
    const result = await sendWhatsAppMessage(
      phoneNumber,
      '✅ Teste de conexão WhatsApp MercoGrain - Sistema funcionando!'
    )

    if (result.success) {
      return {
        success: true,
        message: `✅ Mensagem de teste enviada para ${phoneNumber}`,
      }
    } else {
      return {
        success: false,
        message: `❌ Erro: ${result.error}`,
      }
    }
  } catch (error) {
    return {
      success: false,
      message: `❌ Erro ao testar: ${error instanceof Error ? error.message : 'Unknown'}`,
    }
  }
}
