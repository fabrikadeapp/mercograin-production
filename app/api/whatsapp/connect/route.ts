/**
 * GET /api/whatsapp/connect
 * Initialize WhatsApp connection and return QR code for scanning
 *
 * Flow:
 * 1. Call this endpoint
 * 2. Get QR code (base64 or SVG)
 * 3. Scan with phone's WhatsApp
 * 4. Connection established
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { initializeWhatsApp, getQRCode } from '@/lib/whatsapp-service'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Only admins can manage WhatsApp
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

    // Initialize connection
    await initializeWhatsApp()

    // Get QR code (will be generated shortly)
    let qrCode = await getQRCode()

    // If QR not ready yet, wait a bit
    if (!qrCode) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      qrCode = await getQRCode()
    }

    return NextResponse.json({
      message: 'Conectando ao WhatsApp...',
      qr: qrCode || null,
      instructions: [
        '1. Escaneie o código QR com o WhatsApp do seu telefone',
        '2. Confirme a conexão',
        '3. O sistema enviará mensagens automaticamente',
      ],
      note: 'O QR code expira em 60 segundos. Atualize a página se expirar.',
    })
  } catch (error) {
    console.error('Error connecting WhatsApp:', error)
    return NextResponse.json(
      {
        error: 'Erro ao conectar WhatsApp',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
