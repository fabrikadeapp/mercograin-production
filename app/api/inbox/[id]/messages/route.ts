/**
 * GET /api/inbox/[id]/messages
 *
 * Mensagens de uma conversa unificada. O id segue o formato `wa:`/`portal:`/`cv:`
 * retornado por GET /api/inbox.
 *
 * Query params:
 *  - limit: número (default 50, max 200)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireScope } from '@/lib/auth/scope'
import { getUnifiedMessages } from '@/lib/inbox/conversation-adapter'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await requireScope(searchParams)
    const { id } = await params

    const limit = Number(searchParams.get('limit') ?? '50')

    const result = await getUnifiedMessages(scope.workspaceId, id, limit)
    if (!result.conversation) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const status = msg === 'Não autorizado' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
