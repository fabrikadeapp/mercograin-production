/**
 * POST /api/bhgrain/health/toggle
 *
 * Pausa/retoma uma integração específica do workspace.
 *
 * Body:
 *   {
 *     integration: 'email' | 'whatsapp' | 'instagram' | 'portal' | 'precos' | 'ia' | 'financeiro',
 *     paused: boolean,
 *     pausedUntil?: ISO date (opcional — para "pausar até segunda")
 *     pausedReason?: string (opcional — motivo livre)
 *   }
 *
 * Auth: owner/admin do workspace.
 */

import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { requireBhGrainScope } from '@/lib/bhgrain/scope-permissions'
import { db } from '@/lib/db'
import { setIntegrationPause, KNOWN_INTEGRATIONS } from '@/lib/bhgrain/integration-pause'

export const dynamic = 'force-dynamic'

interface Body {
  integration?: string
  paused?: boolean
  pausedUntil?: string | null
  pausedReason?: string | null
}

export async function POST(req: NextRequest) {
  try {
    const scope = await requireBhGrainScope()
    if (!scope.isAdmin && !['owner', 'admin'].includes(scope.workspaceRole)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as Body
    const integration = String(body.integration ?? '').toLowerCase()
    if (!integration || !KNOWN_INTEGRATIONS.includes(integration as never)) {
      return NextResponse.json(
        { error: 'invalid_integration', allowed: KNOWN_INTEGRATIONS },
        { status: 400 }
      )
    }

    if (typeof body.paused !== 'boolean') {
      return NextResponse.json({ error: 'paused_required' }, { status: 400 })
    }

    const pausedUntil = body.pausedUntil
      ? (() => {
          const d = new Date(body.pausedUntil)
          return Number.isNaN(d.getTime()) ? null : d
        })()
      : null

    const result = await setIntegrationPause({
      workspaceId: scope.workspaceId,
      integration,
      paused: body.paused,
      pausedUntil,
      pausedBy: scope.userId,
      pausedReason: body.pausedReason?.trim().slice(0, 255) ?? null,
    })

    await db.auditLog.create({
      data: {
        userId: scope.userId,
        acao: body.paused ? 'Integração pausada' : 'Integração retomada',
        entidade: 'IntegrationHealth',
        entidadeId: `${scope.workspaceId}:${integration}`,
        workspaceId: scope.workspaceId,
        mudancas: { integration, paused: body.paused, pausedUntil: pausedUntil?.toISOString() ?? null },
      },
    })

    revalidateTag('health')
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
