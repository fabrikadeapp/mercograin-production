/**
 * GET /api/bi/clevel
 * Painel executivo C-Level. Apenas admin/owner do workspace.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { kpisCLevel, volumeMensal, ebitdaMensal } from '@/lib/bi/clevel'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const scope = await getScope(searchParams)
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const allowed =
      scope.isAdmin ||
      scope.isWorkspaceOwner ||
      ['owner', 'admin'].includes(scope.workspaceRole)
    if (!allowed) {
      return NextResponse.json({ error: 'Acesso restrito (admin/owner)' }, { status: 403 })
    }

    const inicioParam = searchParams.get('inicio')
    const fimParam = searchParams.get('fim')
    const periodo = inicioParam && fimParam
      ? { inicio: new Date(inicioParam), fim: new Date(fimParam) }
      : undefined

    const [kpis, volume, ebitda] = await Promise.all([
      kpisCLevel(scope.workspaceId, periodo),
      volumeMensal(scope.workspaceId, 12),
      ebitdaMensal(scope.workspaceId, 12),
    ])

    return NextResponse.json({ kpis, volumeMensal: volume, ebitdaMensal: ebitda })
  } catch (e: any) {
    console.error('GET /api/bi/clevel error:', e)
    return NextResponse.json({ error: 'Erro ao gerar KPIs C-Level' }, { status: 500 })
  }
}
