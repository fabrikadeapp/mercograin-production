/**
 * GET /api/whatsapp/connect
 * Garante que a instance Evolution do workspace existe e devolve QR code.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import {
  ensureInstance as evoEnsureInstance,
  getQRCode,
  EvolutionError,
} from '@/lib/whatsapp/evolution'
import { ensureInstance as ensureWorkspaceInstance } from '@/lib/whatsapp/instance-resolver'

export async function GET(_request: NextRequest) {
  try {
    const scope = await requireScope()
    const wsInstance = await ensureWorkspaceInstance(scope.workspaceId)

    const instance = await evoEnsureInstance(wsInstance.instanceName, {
      webhookSecret: wsInstance.webhookSecret ?? undefined,
    })
    const qr = await getQRCode(wsInstance.instanceName)

    const newStatus =
      instance.status === 'open'
        ? 'connected'
        : qr.base64
          ? 'connecting'
          : wsInstance.status
    await db.whatsAppInstance.update({
      where: { id: wsInstance.id },
      data: {
        status: newStatus,
        lastQrAt: qr.base64 ? new Date() : wsInstance.lastQrAt,
        ...(instance.status === 'open' && !wsInstance.connectedAt
          ? { connectedAt: new Date() }
          : {}),
        ...(instance.ownerJid
          ? {
              phoneJid: instance.ownerJid,
              phoneNumber: instance.ownerJid.split('@')[0] ?? null,
            }
          : {}),
        ...(instance.profileName ? { profileName: instance.profileName } : {}),
        ...(instance.profilePicUrl
          ? { profilePicUrl: instance.profilePicUrl }
          : {}),
      },
    })

    return NextResponse.json({
      status: instance.status,
      qrCode: qr.base64,
      pairingCode: qr.pairingCode ?? null,
      alreadyConnected: qr.alreadyConnected || instance.status === 'open',
      ownerJid: instance.ownerJid ?? null,
      profileName: instance.profileName ?? null,
      instanceName: wsInstance.instanceName,
    })
  } catch (error) {
    const status = error instanceof EvolutionError ? error.status : 500
    const message =
      error instanceof Error ? error.message : 'Erro ao conectar WhatsApp'
    if (message === 'Não autorizado') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    console.error('[whatsapp/connect] erro:', message)
    return NextResponse.json(
      { error: message, status },
      { status: status >= 400 && status < 600 ? status : 500 }
    )
  }
}
