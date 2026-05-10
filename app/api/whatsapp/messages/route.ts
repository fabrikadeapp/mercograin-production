/**
 * GET /api/whatsapp/messages
 *
 * Retorna mensagens WhatsApp persistidas em WhatsAppMessage, scoped por
 * workspace ativo. Substitui o endpoint legado que lia de WebhookLog.
 *
 * Query params:
 *  - contactId   — filtrar por um contato específico (id de WhatsAppContact)
 *  - jid         — alternativa a contactId (lookup pelo JID do WhatsApp)
 *  - limit       — default 50, máx 200
 *  - before      — cursor (timestamp ISO) — retorna mensagens com timestamp < before
 *  - groupBy=contact — retorna inbox: 1 entrada por contato com lastMessage embutida
 *
 * Multi-tenancy: SEMPRE filtra por workspaceId. Mensagens NUNCA vazam.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

function clampLimit(raw: string | null, def = 50, max = 200): number {
  const n = parseInt(raw || '', 10)
  if (!Number.isFinite(n) || n <= 0) return def
  return Math.min(n, max)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await requireScope(searchParams)

    const limit = clampLimit(searchParams.get('limit'))
    const groupBy = searchParams.get('groupBy')

    // Modo inbox: agrupar por contact (1 row por contato com lastMessage)
    if (groupBy === 'contact') {
      const contacts = await db.whatsAppContact.findMany({
        where: { workspaceId: scope.workspaceId },
        orderBy: { lastMessageAt: 'desc' },
        take: limit,
        include: {
          messages: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      })

      const data = contacts.map((c) => {
        const last = c.messages[0]
        return {
          id: c.id,
          jid: c.jid,
          phone: c.phone,
          pushName: c.pushName,
          profilePicUrl: c.profilePicUrl,
          clienteId: c.clienteId,
          fornecedorId: c.fornecedorId,
          lastMessageAt: c.lastMessageAt,
          unreadCount: c.unreadCount,
          lastMessage: last
            ? {
                id: last.id,
                text: last.text,
                fromMe: last.fromMe,
                mediaType: last.mediaType,
                timestamp: last.timestamp,
                status: last.status,
              }
            : null,
        }
      })

      return NextResponse.json({ data, total: data.length })
    }

    // Modo lista: mensagens com filtros opcionais
    const contactIdParam = searchParams.get('contactId')
    const jidParam = searchParams.get('jid')
    const before = searchParams.get('before')

    let contactId: string | null = contactIdParam
    if (!contactId && jidParam) {
      const c = await db.whatsAppContact.findUnique({
        where: {
          workspaceId_jid: {
            workspaceId: scope.workspaceId,
            jid: jidParam,
          },
        },
        select: { id: true },
      })
      contactId = c?.id ?? null
      if (!contactId) {
        return NextResponse.json({ data: [], total: 0 })
      }
    }

    const where: any = { workspaceId: scope.workspaceId }
    if (contactId) where.contactId = contactId
    if (before) {
      const d = new Date(before)
      if (!Number.isNaN(d.getTime())) {
        where.timestamp = { lt: d }
      }
    }

    const rows = await db.whatsAppMessage.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
    })

    const data = rows.map((r) => ({
      id: r.id,
      contactId: r.contactId,
      messageId: r.messageId,
      remoteJid: r.remoteJid,
      fromMe: r.fromMe,
      text: r.text,
      mediaType: r.mediaType,
      mediaUrl: r.mediaUrl,
      mediaCaption: r.mediaCaption,
      replyToMessageId: r.replyToMessageId,
      status: r.status,
      timestamp: r.timestamp,
    }))

    // Cursor para próxima página: timestamp da última mensagem
    const nextCursor = rows.length === limit ? rows[rows.length - 1].timestamp : null

    return NextResponse.json({ data, total: data.length, nextCursor })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao listar mensagens'
    if (message === 'Não autorizado') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    console.error('[whatsapp/messages] erro:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
