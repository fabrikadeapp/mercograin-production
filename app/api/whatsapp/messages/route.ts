/**
 * GET /api/whatsapp/messages?limit=50
 * Lista últimos envios WhatsApp registrados em WebhookLog (tipo='whatsapp_send').
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1),
      200
    )

    const rows = await db.webhookLog.findMany({
      where: { tipo: 'whatsapp_send' },
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
        status: r.status, // recebido | processado | erro
        mensagem: r.mensagem ?? null,
        timestamp: r.criadoEm,
      }
    })

    return NextResponse.json({ data, total: data.length })
  } catch (error) {
    console.error('[whatsapp/messages] erro:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Erro ao listar mensagens',
      },
      { status: 500 }
    )
  }
}
