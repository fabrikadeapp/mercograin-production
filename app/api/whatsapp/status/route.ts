/**
 * GET /api/whatsapp/status
 * Check WhatsApp connection status
 * GET /api/whatsapp/status?include=queue - Include queue stats
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getWhatsAppStatus } from '@/lib/whatsapp-service'
import { getQueueStats } from '@/lib/whatsapp-queue'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Check if user is admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
    })

    if (user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acesso restrito a admins' },
        { status: 403 }
      )
    }

    // Get WhatsApp status
    const waStatus = await getWhatsAppStatus()

    // Check if user wants queue stats
    const { searchParams } = new URL(request.url)
    const includeQueue = searchParams.has('include') && searchParams.get('include') === 'queue'

    const response: any = {
      whatsapp: {
        connected: waStatus.connected,
        phone: waStatus.phone,
        qrAvailable: waStatus.qrAvailable,
        status: waStatus.connected ? '🟢 Conectado' : waStatus.qrAvailable ? '🟡 Aguardando QR' : '🔴 Desconectado',
      },
    }

    if (includeQueue) {
      const queueStats = await getQueueStats()
      response.queue = queueStats
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error getting status:', error)
    return NextResponse.json(
      {
        error: 'Erro ao obter status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
