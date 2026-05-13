/**
 * BH Grain — Inbox unificado (adapter read-only)
 *
 * Mescla múltiplas fontes (WhatsApp, Portal do Produtor, ConversationMessage)
 * em um shape comum `UnifiedConversation`. Não persiste nem altera nada nas
 * tabelas de origem — apenas leitura.
 *
 * Email e Instagram entram como placeholder (lista vazia) até integração real.
 */

import { db } from '@/lib/db'

export type UnifiedChannel = 'whatsapp' | 'email' | 'instagram' | 'portal'

export type UnifiedAiStatus =
  | 'aguardando'
  | 'lida'
  | 'classificado'
  | 'pronta_para_proposta'
  | 'pendente_info'
  | 'nao_comercial'
  | 'erro_leitura'

export interface UnifiedConversation {
  id: string
  source: 'conversation' | 'whatsapp_contact' | 'portal_cliente'
  channel: UnifiedChannel
  clienteId: string | null
  contactName: string | null
  contactHandle: string | null
  lastMessageAt: string | null
  lastMessageText: string | null
  unreadCount: number
  aiStatus: UnifiedAiStatus
}

export interface UnifiedMessage {
  id: string
  conversationId: string
  channel: UnifiedChannel
  direction: 'in' | 'out'
  text: string | null
  occurredAt: string
  aiExtraction: unknown | null
  aiScore: number | null
}

interface ListOptions {
  workspaceId: string
  channel?: UnifiedChannel | 'all'
  limit?: number
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

function clampLimit(n: number | undefined): number {
  if (!n || !Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT
  return Math.min(n, MAX_LIMIT)
}

/**
 * Lista conversas unificadas ordenadas por `lastMessageAt` desc.
 *
 * - WhatsApp: lê de `WhatsAppContact` (já agrega lastMessageAt + unreadCount).
 * - Portal: agrupa `MensagemProdutor` por clienteId.
 * - Conversation: lê direto (canal e status já normalizados).
 * - Email/Instagram: placeholder vazio (TBD em lote futuro).
 */
export async function listUnifiedConversations(
  opts: ListOptions
): Promise<UnifiedConversation[]> {
  const limit = clampLimit(opts.limit)
  const ch = opts.channel ?? 'all'
  const buckets: UnifiedConversation[] = []

  if (ch === 'all' || ch === 'whatsapp') {
    const contacts = await db.whatsAppContact.findMany({
      where: { workspaceId: opts.workspaceId },
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
      include: { messages: { orderBy: { timestamp: 'desc' }, take: 1 } },
    })
    for (const c of contacts) {
      const last = c.messages[0]
      buckets.push({
        id: `wa:${c.id}`,
        source: 'whatsapp_contact',
        channel: 'whatsapp',
        clienteId: c.clienteId,
        contactName: c.pushName ?? c.phone ?? c.jid,
        contactHandle: c.phone ?? c.jid,
        lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
        lastMessageText: last?.text ?? null,
        unreadCount: c.unreadCount,
        aiStatus: 'aguardando',
      })
    }
  }

  if (ch === 'all' || ch === 'portal') {
    const portalGroups = await db.mensagemProdutor.groupBy({
      by: ['clienteId'],
      where: { workspaceId: opts.workspaceId },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
      take: limit,
    })
    if (portalGroups.length > 0) {
      const clienteIds = portalGroups.map((g) => g.clienteId)
      const [clientes, lastMsgs] = await Promise.all([
        db.cliente.findMany({
          where: { id: { in: clienteIds } },
          select: { id: true, nome: true },
        }),
        db.mensagemProdutor.findMany({
          where: { clienteId: { in: clienteIds } },
          orderBy: { createdAt: 'desc' },
          distinct: ['clienteId'],
        }),
      ])
      const clienteMap = new Map(clientes.map((c) => [c.id, c.nome]))
      const lastMap = new Map(lastMsgs.map((m) => [m.clienteId, m]))
      for (const g of portalGroups) {
        const last = lastMap.get(g.clienteId)
        const lidaEm = last?.lidaEm
        buckets.push({
          id: `portal:${g.clienteId}`,
          source: 'portal_cliente',
          channel: 'portal',
          clienteId: g.clienteId,
          contactName: clienteMap.get(g.clienteId) ?? null,
          contactHandle: null,
          lastMessageAt: g._max.createdAt?.toISOString() ?? null,
          lastMessageText: last?.texto ?? null,
          unreadCount: !lidaEm && last?.remetente === 'produtor' ? 1 : 0,
          aiStatus: 'aguardando',
        })
      }
    }
  }

  if (ch === 'all' || ch === 'email' || ch === 'instagram' || ch === 'portal') {
    const channelFilter =
      ch === 'all' ? undefined : ch === 'portal' ? undefined : ch
    const convs = await db.conversation.findMany({
      where: {
        workspaceId: opts.workspaceId,
        ...(channelFilter ? { channel: channelFilter } : {}),
      },
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
      include: { messages: { orderBy: { occurredAt: 'desc' }, take: 1 } },
    })
    for (const c of convs) {
      const last = c.messages[0]
      buckets.push({
        id: `cv:${c.id}`,
        source: 'conversation',
        channel: (c.channel as UnifiedChannel) ?? 'email',
        clienteId: c.clienteId,
        contactName: c.contactName,
        contactHandle: c.contactHandle,
        lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
        lastMessageText: last?.text ?? null,
        unreadCount: c.unreadCount,
        aiStatus: (c.aiStatus as UnifiedAiStatus) ?? 'aguardando',
      })
    }
  }

  buckets.sort((a, b) => {
    const at = a.lastMessageAt ?? ''
    const bt = b.lastMessageAt ?? ''
    return bt.localeCompare(at)
  })

  return buckets.slice(0, limit)
}

/**
 * Resolve uma conversa unificada pelo id prefixado (wa:|portal:|cv:) e retorna
 * suas mensagens. Garante isolamento por workspaceId.
 */
export async function getUnifiedMessages(
  workspaceId: string,
  conversationId: string,
  limit = 50
): Promise<{ conversation: UnifiedConversation | null; messages: UnifiedMessage[] }> {
  const lim = clampLimit(limit)
  const [prefix, rawId] = conversationId.split(':', 2)
  if (!prefix || !rawId) return { conversation: null, messages: [] }

  if (prefix === 'wa') {
    const contact = await db.whatsAppContact.findFirst({
      where: { id: rawId, workspaceId },
      include: {
        messages: { orderBy: { timestamp: 'desc' }, take: lim },
      },
    })
    if (!contact) return { conversation: null, messages: [] }
    return {
      conversation: {
        id: `wa:${contact.id}`,
        source: 'whatsapp_contact',
        channel: 'whatsapp',
        clienteId: contact.clienteId,
        contactName: contact.pushName ?? contact.phone ?? contact.jid,
        contactHandle: contact.phone ?? contact.jid,
        lastMessageAt: contact.lastMessageAt?.toISOString() ?? null,
        lastMessageText: contact.messages[0]?.text ?? null,
        unreadCount: contact.unreadCount,
        aiStatus: 'aguardando',
      },
      messages: contact.messages.map((m) => ({
        id: m.id,
        conversationId: `wa:${contact.id}`,
        channel: 'whatsapp',
        direction: m.fromMe ? 'out' : 'in',
        text: m.text,
        occurredAt: m.timestamp.toISOString(),
        aiExtraction: null,
        aiScore: null,
      })),
    }
  }

  if (prefix === 'portal') {
    const [cliente, msgs] = await Promise.all([
      db.cliente.findFirst({
        where: { id: rawId, workspaceId },
        select: { id: true, nome: true },
      }),
      db.mensagemProdutor.findMany({
        where: { clienteId: rawId, workspaceId },
        orderBy: { createdAt: 'desc' },
        take: lim,
      }),
    ])
    if (!cliente) return { conversation: null, messages: [] }
    return {
      conversation: {
        id: `portal:${cliente.id}`,
        source: 'portal_cliente',
        channel: 'portal',
        clienteId: cliente.id,
        contactName: cliente.nome,
        contactHandle: null,
        lastMessageAt: msgs[0]?.createdAt.toISOString() ?? null,
        lastMessageText: msgs[0]?.texto ?? null,
        unreadCount: 0,
        aiStatus: 'aguardando',
      },
      messages: msgs.map((m) => ({
        id: m.id,
        conversationId: `portal:${cliente.id}`,
        channel: 'portal',
        direction: m.remetente === 'produtor' ? 'in' : 'out',
        text: m.texto,
        occurredAt: m.createdAt.toISOString(),
        aiExtraction: null,
        aiScore: null,
      })),
    }
  }

  if (prefix === 'cv') {
    const conv = await db.conversation.findFirst({
      where: { id: rawId, workspaceId },
      include: {
        messages: { orderBy: { occurredAt: 'desc' }, take: lim },
      },
    })
    if (!conv) return { conversation: null, messages: [] }
    return {
      conversation: {
        id: `cv:${conv.id}`,
        source: 'conversation',
        channel: (conv.channel as UnifiedChannel) ?? 'email',
        clienteId: conv.clienteId,
        contactName: conv.contactName,
        contactHandle: conv.contactHandle,
        lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
        lastMessageText: conv.messages[0]?.text ?? null,
        unreadCount: conv.unreadCount,
        aiStatus: (conv.aiStatus as UnifiedAiStatus) ?? 'aguardando',
      },
      messages: conv.messages.map((m) => ({
        id: m.id,
        conversationId: `cv:${conv.id}`,
        channel: (conv.channel as UnifiedChannel) ?? 'email',
        direction: m.direction === 'out' ? 'out' : 'in',
        text: m.text,
        occurredAt: m.occurredAt.toISOString(),
        aiExtraction: m.aiExtraction,
        aiScore: m.aiScore,
      })),
    }
  }

  return { conversation: null, messages: [] }
}

/**
 * Contadores agregados para o badge do menu (Inbox 12).
 */
export async function countUnread(workspaceId: string): Promise<{
  total: number
  byChannel: Record<UnifiedChannel, number>
}> {
  const [waAgg, portalUnread, cvAgg] = await Promise.all([
    db.whatsAppContact.aggregate({
      where: { workspaceId },
      _sum: { unreadCount: true },
    }),
    db.mensagemProdutor.count({
      where: { workspaceId, remetente: 'produtor', lidaEm: null },
    }),
    db.conversation.groupBy({
      by: ['channel'],
      where: { workspaceId },
      _sum: { unreadCount: true },
    }),
  ])

  const byChannel: Record<UnifiedChannel, number> = {
    whatsapp: waAgg._sum.unreadCount ?? 0,
    email: 0,
    instagram: 0,
    portal: portalUnread,
  }
  for (const row of cvAgg) {
    const k = row.channel as UnifiedChannel
    if (k in byChannel) byChannel[k] += row._sum.unreadCount ?? 0
  }
  const total = byChannel.whatsapp + byChannel.email + byChannel.instagram + byChannel.portal
  return { total, byChannel }
}
