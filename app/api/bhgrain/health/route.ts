/**
 * GET /api/bhgrain/health
 *
 * Snapshot do health das integrações do workspace ativo.
 */

import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { requireScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const getHealthCached = unstable_cache(
  async (workspaceId: string) => {
    return db.integrationHealth.findMany({
      where: { workspaceId },
      orderBy: { integration: 'asc' },
    })
  },
  ['integration-health'],
  { revalidate: 30, tags: ['health'] },
)

export async function GET() {
  try {
    const scope = await requireScope()
    const rows = await getHealthCached(scope.workspaceId)
    return NextResponse.json({
      integrations: rows.map((r) => ({
        integration: r.integration,
        status: r.status,
        lastSuccessAt: r.lastSuccessAt?.toISOString() ?? null,
        lastFailureAt: r.lastFailureAt?.toISOString() ?? null,
        responseTimeMs: r.responseTimeMs,
        pendingEvents: r.pendingEvents,
        processedEvents: r.processedEvents,
        lastErrorMessage: r.lastErrorMessage,
        // Toggle pausar/retomar
        paused: r.paused,
        pausedUntil: r.pausedUntil?.toISOString() ?? null,
        pausedBy: r.pausedBy,
        pausedReason: r.pausedReason,
        updatedAt: r.updatedAt.toISOString(),
      })),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const status = msg === 'Não autorizado' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
