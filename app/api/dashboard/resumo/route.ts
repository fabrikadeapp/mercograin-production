/**
 * GET /api/dashboard/resumo
 *
 * BH Grain — Payload único do dashboard principal.
 * Multi-tenant via requireScope. Cacheável em CDN por 30s no client.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireScope } from '@/lib/auth/scope'
import { buildDashboardResumo } from '@/lib/bhgrain/dashboard-resumo'
import { isBhGrainV1Enabled } from '@/lib/bhgrain/feature-flag'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await requireScope(searchParams)

    const enabled = await isBhGrainV1Enabled()
    if (!enabled) {
      return NextResponse.json({ enabled: false }, { status: 200 })
    }

    const resumo = await buildDashboardResumo(scope.workspaceId)
    return NextResponse.json({ enabled: true, resumo })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const status = msg === 'Não autorizado' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
