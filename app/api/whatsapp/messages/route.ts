/**
 * GET /api/whatsapp/messages?limit=50
 * Lista últimos envios WhatsApp registrados em WebhookLog (tipo='whatsapp_send'),
 * filtrados pelo workspaceId atual (admin pode usar ?scope=all).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await requireScope(searchParams)

    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1),
      200
    )

    const wantAll = scope.isAdmin && searchParams.get('scope') === 'all'
    const baseWhere: any = { tipo: 'whatsapp_send' }
    if (!wantAll) {
      // Filtra logs cujo payload.workspaceId == scope.workspaceId
      // Backwards-compat: também aceita logs antigos que tinham apenas userId do user atual
      baseWhere.OR = [
        { payload: { path: ['workspaceId'], equals: scope.workspaceId } },
        { payload: { path: ['userId'], equals: scope.userId } },
      ]
    }

    const rows = await db.webhookLog.findMany({
      where: baseWhere,
      orderBy: { criadoEm: 'desc' },
      take: limit,
    })

    const data = rows.map((r) => {
      const p = (r.payload as any) ?? {}
      return {
        id: r.id,
        number: p.number ?? '',
        text: p.text ?? '',
        messageId: p.messageId ?? null,
        status: r.status,
        mensagem: r.mensagem ?? null,
        timestamp: r.criadoEm,
      }
    })

    return NextResponse.json({ data, total: data.length })
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
