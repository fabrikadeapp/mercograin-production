/**
 * GET /api/inbox
 *
 * BH Grain — Inbox unificado (read-only). Mescla WhatsApp + Portal +
 * Conversation. Email/Instagram entram quando ingestão for implementada.
 *
 * Query params:
 *  - channel: 'all' | 'whatsapp' | 'email' | 'instagram' | 'portal' (default all)
 *  - limit: número (default 50, max 200)
 *
 * Resposta:
 *  { conversations: UnifiedConversation[], counts: { total, byChannel } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireScope } from '@/lib/auth/scope'
import {
  listUnifiedConversations,
  countUnread,
  type UnifiedChannel,
} from '@/lib/inbox/conversation-adapter'

export const dynamic = 'force-dynamic'

const VALID_CHANNELS: ReadonlyArray<UnifiedChannel | 'all'> = [
  'all',
  'whatsapp',
  'email',
  'instagram',
  'portal',
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await requireScope(searchParams)

    const rawChannel = searchParams.get('channel') ?? 'all'
    const channel = (VALID_CHANNELS as readonly string[]).includes(rawChannel)
      ? (rawChannel as UnifiedChannel | 'all')
      : 'all'

    const limit = Number(searchParams.get('limit') ?? '50')

    const [conversations, counts] = await Promise.all([
      listUnifiedConversations({
        workspaceId: scope.workspaceId,
        channel,
        limit,
      }),
      countUnread(scope.workspaceId),
    ])

    return NextResponse.json({ conversations, counts })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const status = msg === 'Não autorizado' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
