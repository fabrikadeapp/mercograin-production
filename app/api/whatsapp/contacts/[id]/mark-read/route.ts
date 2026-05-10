/**
 * POST /api/whatsapp/contacts/[id]/mark-read
 *
 * Zera unreadCount do contato. Multi-tenant: só atualiza se o contato
 * pertence ao workspace ativo do user.
 */
import { NextResponse } from 'next/server'
import { requireScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await requireScope()
    const id = params.id

    const result = await db.whatsAppContact.updateMany({
      where: { id, workspaceId: scope.workspaceId },
      data: { unreadCount: 0 },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro'
    if (message === 'Não autorizado') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    console.error('[whatsapp/mark-read] erro:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
