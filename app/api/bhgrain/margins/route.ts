/**
 * GET /api/bhgrain/margins
 *
 * Retorna o mapa de margens por commodity do workspace ativo.
 * Usado pelo formulário /propostas/nova para pré-preencher o campo de margem
 * ao selecionar o grão.
 */

import { NextResponse } from 'next/server'
import { requireScope } from '@/lib/auth/scope'
import { getMarginMap } from '@/lib/bhgrain/margin-rules'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const scope = await requireScope()
    const map = await getMarginMap(scope.workspaceId)
    return NextResponse.json({ margins: map })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const status = msg === 'Não autorizado' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
