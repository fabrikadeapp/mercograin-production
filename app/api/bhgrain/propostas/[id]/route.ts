/**
 * GET /api/bhgrain/propostas/[id]
 *
 * Detalhe completo de uma proposta (drawer): score, margem, cotação,
 * comparativo de mercado, próxima ação, timeline, auditoria.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireScope } from '@/lib/auth/scope'
import { buildPropostaDetalhe } from '@/lib/bhgrain/proposta-detalhe'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await requireScope(searchParams)
    const { id } = await params
    const detalhe = await buildPropostaDetalhe(scope.workspaceId, id)
    if (!detalhe) return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
    return NextResponse.json(detalhe)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const status = msg === 'Não autorizado' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
