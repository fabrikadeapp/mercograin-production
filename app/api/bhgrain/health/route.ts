/**
 * GET /api/bhgrain/health
 *
 * Snapshot do health das integrações do workspace ativo.
 */

import { NextResponse } from 'next/server'
import { requireScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const scope = await requireScope()
    const rows = await db.integrationHealth.findMany({
      where: { workspaceId: scope.workspaceId },
      orderBy: { integration: 'asc' },
    })
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
        updatedAt: r.updatedAt.toISOString(),
      })),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const status = msg === 'Não autorizado' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
