/**
 * Admin: Webhook status / re-apply.
 *
 * GET   — lista todas as WhatsAppInstance com webhook URL atual.
 * POST  — re-aplica webhook em todas as instâncias (gera webhookSecret se faltar).
 *
 * Útil pra:
 * - Validar quais instâncias já estão recebendo webhook
 * - Migrar retroativamente instâncias antigas (sem webhookSecret)
 */
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'
import { db } from '@/lib/db'
import { setWebhook as evoSetWebhook } from '@/lib/whatsapp/evolution'
import { buildWebhookUrl } from '@/lib/whatsapp/instance-resolver'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    await requireAdmin()
    const rows = await db.whatsAppInstance.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        workspaceId: true,
        instanceName: true,
        status: true,
        connectedAt: true,
        disconnectedAt: true,
        lastQrAt: true,
        webhookSecret: true,
        createdAt: true,
        updatedAt: true,
        workspace: { select: { name: true, slug: true } },
      },
    })
    const data = rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      workspace: r.workspace,
      instanceName: r.instanceName,
      status: r.status,
      connectedAt: r.connectedAt,
      disconnectedAt: r.disconnectedAt,
      lastQrAt: r.lastQrAt,
      hasWebhookSecret: !!r.webhookSecret,
      webhookUrl: buildWebhookUrl(r.instanceName),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    return NextResponse.json({ data, total: data.length })
  } catch (e) {
    return adminErrorResponse(e)
  }
}

export async function POST() {
  try {
    await requireAdmin()
    const rows = await db.whatsAppInstance.findMany({
      select: {
        id: true,
        instanceName: true,
        webhookSecret: true,
      },
    })

    const results: Array<{
      instanceName: string
      ok: boolean
      error?: string
    }> = []

    for (const r of rows) {
      const url = buildWebhookUrl(r.instanceName)
      if (!url) {
        results.push({
          instanceName: r.instanceName,
          ok: false,
          error: 'NEXT_PUBLIC_APP_URL não configurada',
        })
        continue
      }
      let secret = r.webhookSecret
      if (!secret) {
        secret = crypto.randomBytes(32).toString('hex')
        await db.whatsAppInstance.update({
          where: { id: r.id },
          data: { webhookSecret: secret },
        })
      }
      try {
        await evoSetWebhook(r.instanceName, url, secret)
        results.push({ instanceName: r.instanceName, ok: true })
      } catch (e: any) {
        results.push({
          instanceName: r.instanceName,
          ok: false,
          error: e?.message || 'erro desconhecido',
        })
      }
    }

    return NextResponse.json({
      total: results.length,
      ok: results.filter((x) => x.ok).length,
      failed: results.filter((x) => !x.ok).length,
      results,
    })
  } catch (e) {
    return adminErrorResponse(e)
  }
}
