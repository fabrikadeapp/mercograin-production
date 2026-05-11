/**
 * GET /api/bi/benchmark
 * Benchmark anonimizado entre workspaces. Retorna posição relativa do tenant
 * sem revelar nomes/IDs alheios. Apenas owner/admin do workspace.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { benchmarkMercado } from '@/lib/bi/benchmark'

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

    const data = await benchmarkMercado(scope.workspaceId)
    return NextResponse.json(data)
  } catch (e: any) {
    console.error('GET /api/bi/benchmark error:', e)
    return NextResponse.json({ error: 'Erro ao gerar benchmark' }, { status: 500 })
  }
}
