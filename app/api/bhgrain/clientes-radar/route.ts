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
    const clientes = await listClientesRadar(scope.workspaceId, limit)
    return NextResponse.json({ clientes })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const status = msg === 'Não autorizado' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
