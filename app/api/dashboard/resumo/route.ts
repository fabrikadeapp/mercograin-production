/**
 * GET /api/dashboard/resumo
 *
 * BH Grain — Payload único do dashboard principal.
 * Multi-tenant via requireScope. Cacheável em CDN por 30s no client.
 *
 * Query params (todos opcionais):
 *  - periodo: 'hoje' | '7d' | '15d' | '30d' | 'custom'  (default '30d')
 *  - commodity: 'soja' | 'milho' | 'trigo' (sem param = todas)
 *  - dataInicio: ISO date (só com periodo=custom)
 *  - dataFim: ISO date (só com periodo=custom)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireScope } from '@/lib/auth/scope'
import { buildDashboardResumo, type DashboardFiltros } from '@/lib/bhgrain/dashboard-resumo'
import { isBhGrainV1Enabled } from '@/lib/bhgrain/feature-flag'

export const dynamic = 'force-dynamic'

function parseFiltros(searchParams: URLSearchParams): DashboardFiltros {
  const rawPeriodo = searchParams.get('periodo')
  const periodo: DashboardFiltros['periodo'] =
    rawPeriodo === 'hoje' ||
    rawPeriodo === '7d' ||
    rawPeriodo === '15d' ||
    rawPeriodo === '30d' ||
    rawPeriodo === 'custom'
      ? rawPeriodo
      : '30d'

  const rawCommodity = searchParams.get('commodity')?.toLowerCase()
  const commodity: DashboardFiltros['commodity'] =
    rawCommodity === 'soja' || rawCommodity === 'milho' || rawCommodity === 'trigo'
      ? rawCommodity
      : null

  const dataInicio = searchParams.get('dataInicio') || null
  const dataFim = searchParams.get('dataFim') || null

  return { periodo, commodity, dataInicio, dataFim }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await requireScope(searchParams)

    const enabled = await isBhGrainV1Enabled()
    if (!enabled) {
      return NextResponse.json({ enabled: false }, { status: 200 })
    }

    const filtros = parseFiltros(searchParams)
    const resumo = await buildDashboardResumo(scope.workspaceId, filtros)
    return NextResponse.json({ enabled: true, resumo, filtros })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const status = msg === 'Não autorizado' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
