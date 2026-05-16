/**
 * Evolution API webhook handler — processa eventos por tipo.
 *
 * Idempotência: WhatsAppMessage tem @@unique([workspaceId, messageId]). Re-entregas
 * disparam P2002 e são ignoradas.
 *
 * Multi-tenancy: TODA escrita filtra por instance.workspaceId. Mensagens NUNCA
 * vazam entre workspaces.
 */
import type { PrismaClient } from '@prisma/client'
import { db as defaultDb } from '@/lib/db'
import { processCommand } from './bot-commands'
import { captureError } from '@/lib/observability/capture'
import { wireBhGrainFromWhatsApp } from '@/lib/bhgrain/wire-whatsapp'

export interface InstanceCtx {
  id: string
  workspaceId: string
  /**
   * Opcional: nome da instância Evolution. Necessário pra que o parser
   * de comandos possa enviar respostas. Quando ausente, comandos são
   * silenciosamente ignorados.
   */
  instanceName?: string
  /**
   * Quando a integração WhatsApp está PAUSADA pelo cliente, mensagens
   * recebidas viram silenced=true + recebem este batchId. IA/bot/wiring
   * são pulados — admin vê o backlog e decide ao reativar.
   * Null/undefined = ingestão normal.
   */
  silencedBatchId?: string | null
}

export interface EvolutionWebhookPayload {
  event: string
  instance?: string
  data: any
  date_time?: string
}

type DbLike = PrismaClient | typeof defaultDb

/**
 * Roteador de eventos. Usado pelo route handler. Em caso de erro,
 * o caller deve logar via captureError mas SEMPRE retornar 200 ao Evolution
 * para evitar loop de retry.
 */
export async function handleEvolutionEvent(
  instance: InstanceCtx,
  payload: EvolutionWebhookPayload,
  db: DbLike = defaultDb
): Promise<void> {
  switch (payload.event) {
    case 'messages.upsert':
    case 'MESSAGES_UPSERT':
      await handleMessageUpsert(instance, payload.data, db)
      break
    case 'connection.update':
    case 'CONNECTION_UPDATE':
      await handleConnectionUpdate(instance, payload.data, db)
      break
    case 'qrcode.updated':
    case 'QRCODE_UPDATED':
      await handleQrCodeUpdated(instance, payload.data, db)
      break
    default:
      // outros eventos: ignorar silenciosamente
      break
  }
}

async function handleMessageUpsert(
  instance: InstanceCtx,
  data: any,
  db: DbLike
) {
  if (!data) return
  // Evolution pode mandar { messages: [...] } ou um objeto único ou array direto
  const messages = Array.isArray(data)
    ? data
    : Array.isArray(data?.messages)
    ? data.messages
    : [data]
  for (const msg of messages) {
    if (msg) await processMessage(instance, msg, db)
  }
}

export async function processMessage(
  instance: InstanceCtx,
  msg: any,
  db: DbLike = defaultDb
): Promise<void> {
  if (!msg?.key?.id) return
  const remoteJid = msg.key.remoteJid as string
  if (!remoteJid) return

  // Foco em 1:1, ignorar grupos/broadcast por enquanto
  if (remoteJid.includes('@g.us')) return
  if (remoteJid.includes('@broadcast')) return

  const fromMe = !!msg.key.fromMe
  const messageId = String(msg.key.id)
  const tsRaw = msg.messageTimestamp
  const timestamp = tsRaw
    ? new Date(Number(tsRaw) * 1000)
    : new Date()

  const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    null

  let mediaType: string | null = null
  let mediaCaption: string | null = null
  if (msg.message?.imageMessage) {
    mediaType = 'image'
    mediaCaption = msg.message.imageMessage.caption || null
  } else if (msg.message?.videoMessage) {
    mediaType = 'video'
    mediaCaption = msg.message.videoMessage.caption || null
  } else if (msg.message?.audioMessage) {
    mediaType = 'audio'
  } else if (msg.message?.documentMessage) {
    mediaType = 'document'
    mediaCaption = msg.message.documentMessage.caption || null
  } else if (msg.message?.stickerMessage) {
    mediaType = 'sticker'
  }

  const phone = remoteJid.split('@')[0].replace(/\D/g, '')
  const pushName = msg.pushName || msg.notifyName || null

  const replyToMessageId =
    msg.message?.extendedTextMessage?.contextInfo?.stanzaId || null

  const isSilenced = !!instance.silencedBatchId

  const contact = await db.whatsAppContact.upsert({
    where: {
      workspaceId_jid: {
        workspaceId: instance.workspaceId,
        jid: remoteJid,
      },
    },
    create: {
      workspaceId: instance.workspaceId,
      jid: remoteJid,
      phone: phone || null,
      pushName,
      lastMessageAt: timestamp,
      // Silenciada: não conta no badge de não-lidas
      unreadCount: fromMe || isSilenced ? 0 : 1,
    },
    update: {
      pushName: pushName || undefined,
      lastMessageAt: timestamp,
      unreadCount: fromMe || isSilenced ? undefined : { increment: 1 },
    },
  })

  try {
    await db.whatsAppMessage.create({
      data: {
        workspaceId: instance.workspaceId,
        contactId: contact.id,
        messageId,
        remoteJid,
        fromMe,
        text,
        mediaType,
        mediaUrl: null,
        mediaCaption,
        replyToMessageId,
        timestamp,
        status: fromMe ? 'sent' : 'delivered',
        silenced: isSilenced,
        silencedBatchId: instance.silencedBatchId ?? null,
        silencedAt: isSilenced ? new Date() : null,
      },
    })
  } catch (e: any) {
    // P2002 = duplicate (re-entrega) — ignorar silenciosamente
    if (e?.code !== 'P2002') throw e
    // duplicate: NÃO disparar bot novamente (evita resposta dupla em retry)
    return
  }

  // Silenciada: pula bot/wiring/IA. Cliente decide ao reativar a integração.
  if (isSilenced) return

  // Bot commands: só pra mensagens inbound novas com texto.
  // Falhas no bot NUNCA propagam — webhook precisa retornar 200.
  if (!fromMe && text && instance.instanceName) {
    try {
      await processCommand(text, {
        workspaceId: instance.workspaceId,
        instanceName: instance.instanceName,
        remoteJid,
      })
    } catch (e) {
      captureError(e, {
        where: 'webhook-handler.processCommand',
        workspaceId: instance.workspaceId,
      })
    }
  }

  // BH Grain — wiring async (não bloqueia o webhook).
  // Classifica via IA, atualiza Conversation/ConversationMessage, e cria
  // Rascunho IA se for pedido de cotação com dados completos.
  void wireBhGrainFromWhatsApp({
    workspaceId: instance.workspaceId,
    contactId: contact.id,
    jid: remoteJid,
    contactName: pushName,
    contactPhone: phone || null,
    messageId,
    text,
    timestamp,
    fromMe,
  })
}

async function handleConnectionUpdate(
  instance: InstanceCtx,
  data: any,
  db: DbLike
) {
  const state = data?.state || data?.connection || data?.status
  let status = 'disconnected'
  if (state === 'open' || state === 'connected') status = 'connected'
  else if (state === 'connecting') status = 'connecting'
  else if (state === 'close' || state === 'closed') status = 'disconnected'

  await db.whatsAppInstance.update({
    where: { id: instance.id },
    data: {
      status,
      ...(status === 'connected' ? { connectedAt: new Date() } : {}),
      ...(status === 'disconnected' ? { disconnectedAt: new Date() } : {}),
    },
  })
}

async function handleQrCodeUpdated(
  instance: InstanceCtx,
  _data: any,
  db: DbLike
) {
  await db.whatsAppInstance.update({
    where: { id: instance.id },
    data: { lastQrAt: new Date(), status: 'connecting' },
  })
}
