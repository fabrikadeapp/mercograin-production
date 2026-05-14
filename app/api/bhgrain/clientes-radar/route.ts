/**
 * GET /api/bhgrain/clientes-radar
 *
 * Lista clientes priorizados com tag de radar (quente/em risco/follow-up etc).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireScope } from '@/lib/auth/scope'
import { listClientesRadar } from '@/lib/bhgrain/clientes-radar'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await requireScope(searchParams)
    const limit = Math.min(20, Math.max(1, Number(searchParams.get('limit') ?? '8')))

    // Aceita filtros do dashboard (mesma convenção de /api/dashboard/resumo).
    const rawPeriodo = searchParams.get('periodo')
    const periodo =
      rawPeriodo === 'hoje' ||
      rawPeriodo === '7d' ||
      rawPeriodo === '15d' ||
      rawPeriodo === '30d' ||
      rawPeriodo === 'custom'
        ? rawPeriodo
        : null
    const rawCommodity = searchParams.get('commodity')?.toLowerCase()
    const commodity =
      rawCommodity === 'soja' || rawCommodity === 'milho' || rawCommodity === 'trigo'
        ? rawCommodity
        : null
    const dataInicio = searchParams.get('dataInicio') || null
    const dataFim = searchParams.get('dataFim') || null

    const clientes = await listClientesRadar(scope.workspaceId, limit, {
      periodo,
      commodity,
      dataInicio,
      dataFim,
    })
    return NextResponse.json({ clientes })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const status = msg === 'Não autorizado' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
