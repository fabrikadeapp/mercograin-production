/**
 * GET /api/whatsapp/connect
 * Garante que a instance Evolution existe e devolve QR code (base64) + pairing code.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  ensureInstance,
  getQRCode,
  EvolutionError,
} from '@/lib/whatsapp/evolution'

export async function GET(_request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const instance = await ensureInstance()
    const qr = await getQRCode()

    return NextResponse.json({
      status: instance.status,
      qrCode: qr.base64,
      pairingCode: qr.pairingCode ?? null,
      alreadyConnected: qr.alreadyConnected || instance.status === 'open',
      ownerJid: instance.ownerJid ?? null,
      profileName: instance.profileName ?? null,
    })
  } catch (error) {
    const status = error instanceof EvolutionError ? error.status : 500
    const message =
      error instanceof Error ? error.message : 'Erro ao conectar WhatsApp'
    console.error('[whatsapp/connect] erro:', message)
    return NextResponse.json(
      { error: message, status },
      { status: status >= 400 && status < 600 ? status : 500 }
    )
  }
}
