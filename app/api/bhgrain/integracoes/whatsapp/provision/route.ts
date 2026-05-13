/**
 * POST /api/bhgrain/integracoes/whatsapp/provision
 *
 * Auto-provision de instância WhatsApp no modo central:
 *  1. Chama ensureInstance(workspaceId) — provisiona no Evolution central
 *  2. Salva metadados em IntegrationCredential(channel='whatsapp', modo='central')
 *  3. Retorna { qrCodeUrl?, status }
 *
 * No modo BYO, este endpoint retorna 400 — cliente deve configurar manualmente.
 */

import { NextResponse } from 'next/server'
import { requireBhGrainScope } from '@/lib/bhgrain/scope-permissions'
import { db } from '@/lib/db'
import { ensureInstance } from '@/lib/whatsapp/instance-resolver'
import { saveWhatsappCredential } from '@/lib/bhgrain/credentials'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  try {
    const scope = await requireBhGrainScope()
    if (!scope.isAdmin && !['owner', 'admin'].includes(scope.workspaceRole)) {
      return NextResponse.json({ error: 'Apenas owner/admin' }, { status: 403 })
    }

    const modeRow = await db.systemConfig.findUnique({ where: { key: 'bhgrain.whatsapp.mode' } })
    const modeValue = (modeRow?.value as { mode?: string; centralBaseUrl?: string; centralApiKey?: string } | null) ?? {}
    const mode = modeValue.mode ?? 'hybrid'

    if (mode === 'byo') {
      return NextResponse.json({ error: 'Modo BYO — configure manualmente em /configuracoes/integracoes' }, { status: 400 })
    }
    if (!modeValue.centralBaseUrl) {
      return NextResponse.json({ error: 'Servidor central não configurado pelo super-admin' }, { status: 500 })
    }

    // Provisiona (idempotente)
    const instance = await ensureInstance(scope.workspaceId)

    // Salva metadados na IntegrationCredential
    await saveWhatsappCredential(
      scope.workspaceId,
      {
        modo: 'central',
        instanceName: instance.instanceName,
        baseUrl: modeValue.centralBaseUrl,
        phoneNumber: instance.phoneNumber ?? null,
      },
      // apiKey: usa central
      modeValue.centralApiKey ? { apiKey: modeValue.centralApiKey } : {},
      { enabled: true, userId: scope.userId }
    )

    await db.auditLog.create({
      data: {
        userId: scope.userId,
        acao: 'WhatsApp instância provisionada (modo central)',
        entidade: 'IntegrationCredential',
        entidadeId: `${scope.workspaceId}:whatsapp`,
        workspaceId: scope.workspaceId,
        mudancas: { instanceName: instance.instanceName, status: instance.status },
      },
    })

    return NextResponse.json({
      ok: true,
      instanceName: instance.instanceName,
      status: instance.status,
      qrCodeUrl: `/api/whatsapp/connect`, // página existente faz QR pairing
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
