/**
 * GET  /api/bhgrain/health/silenced
 *   Retorna contagem de mensagens silenciadas pendentes por canal.
 *   Usado pelo InboxCard para mostrar badge "N silenciadas" e pelo
 *   toast de reativação.
 *
 * POST /api/bhgrain/health/silenced
 *   Body: { integration, action: 'process' | 'mark_read' | 'discard' }
 *   - process: tira silenced=true das mensagens (passam a normais)
 *              e dispara aiStatus=aguardando nas Conversations afetadas.
 *   - mark_read: remove silenced + zera unreadCount.
 *   - discard: delete msgs silenciadas (irrecuperável).
 *
 * Auth: owner/admin do workspace.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireBhGrainScope } from '@/lib/bhgrain/scope-permissions'
import { KNOWN_INTEGRATIONS, type IntegrationKey } from '@/lib/bhgrain/integration-pause'

export const dynamic = 'force-dynamic'

/** Mapeia integração → channel da Conversation / canal WhatsApp. */
function integrationToChannel(integration: IntegrationKey | string): 'email' | 'instagram' | 'portal' | 'whatsapp' | null {
  if (integration === 'email') return 'email'
  if (integration === 'instagram') return 'instagram'
  if (integration === 'portal') return 'portal'
  if (integration === 'whatsapp') return 'whatsapp'
  return null
}

export async function GET() {
  try {
    const scope = await requireBhGrainScope()
    // Conta silenciadas em ConversationMessage agrupadas por canal
    const convMsgs = await db.conversationMessage.findMany({
      where: { workspaceId: scope.workspaceId, silenced: true },
      select: { conversation: { select: { channel: true } } },
      take: 5000,
    })
    const waMsgs = await db.whatsAppMessage.count({
      where: { workspaceId: scope.workspaceId, silenced: true },
    })

    const byChannel: Record<string, number> = {
      whatsapp: waMsgs,
      email: 0,
      instagram: 0,
      portal: 0,
    }
    for (const m of convMsgs) {
      const ch = m.conversation.channel
      byChannel[ch] = (byChannel[ch] ?? 0) + 1
    }
    const total = Object.values(byChannel).reduce((a, b) => a + b, 0)

    return NextResponse.json({ total, byChannel })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

interface PostBody {
  integration?: string
  action?: 'process' | 'mark_read' | 'discard'
}

export async function POST(req: NextRequest) {
  try {
    const scope = await requireBhGrainScope()
    if (!scope.isAdmin && !['owner', 'admin'].includes(scope.workspaceRole)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    const body = (await req.json().catch(() => ({}))) as PostBody
    const integration = String(body.integration ?? '').toLowerCase()
    if (!KNOWN_INTEGRATIONS.includes(integration as never)) {
      return NextResponse.json({ error: 'invalid_integration' }, { status: 400 })
    }
    const action = body.action ?? 'process'
    if (!['process', 'mark_read', 'discard'].includes(action)) {
      return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
    }

    const channel = integrationToChannel(integration)
    if (!channel) return NextResponse.json({ error: 'channel_not_supported' }, { status: 400 })

    let affected = 0

    if (channel === 'whatsapp') {
      if (action === 'discard') {
        const r = await db.whatsAppMessage.deleteMany({
          where: { workspaceId: scope.workspaceId, silenced: true },
        })
        affected = r.count
      } else {
        const r = await db.whatsAppMessage.updateMany({
          where: { workspaceId: scope.workspaceId, silenced: true },
          data: {
            silenced: false,
            silencedBatchId: null,
            silencedAt: null,
          },
        })
        affected = r.count
      }
    } else {
      // ConversationMessage (email, instagram, portal)
      if (action === 'discard') {
        const r = await db.conversationMessage.deleteMany({
          where: {
            workspaceId: scope.workspaceId,
            silenced: true,
            conversation: { channel },
          },
        })
        affected = r.count
      } else {
        const r = await db.conversationMessage.updateMany({
          where: {
            workspaceId: scope.workspaceId,
            silenced: true,
            conversation: { channel },
          },
          data: {
            silenced: false,
            silencedBatchId: null,
            silencedAt: null,
          },
        })
        affected = r.count

        // Atualiza aiStatus das Conversations:
        // - process: 'aguardando' (vai pra fila de IA)
        // - mark_read: 'lida' + zera unread
        if (action === 'process') {
          await db.conversation.updateMany({
            where: {
              workspaceId: scope.workspaceId,
              channel,
              aiStatus: 'silenciada',
            },
            data: { aiStatus: 'aguardando' },
          })
        } else if (action === 'mark_read') {
          await db.conversation.updateMany({
            where: {
              workspaceId: scope.workspaceId,
              channel,
              aiStatus: 'silenciada',
            },
            data: { aiStatus: 'lida', unreadCount: 0 },
          })
        }
      }
    }

    await db.auditLog.create({
      data: {
        userId: scope.userId,
        acao: `Silenciadas · ${action}`,
        entidade: 'IntegrationHealth',
        entidadeId: `${scope.workspaceId}:${integration}`,
        workspaceId: scope.workspaceId,
        mudancas: { integration, action, affected },
      },
    })

    return NextResponse.json({ ok: true, action, affected })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
