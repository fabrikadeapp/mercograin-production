/**
 * GET /api/bi/corretor/[id]
 * KPIs de desempenho do corretor. Valida que o corretor pertence ao workspace do usuário.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { kpisCorretor } from '@/lib/bi/corretor'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url)
    const scope = await getScope(searchParams)
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const corretor = await db.corretor.findFirst({
      where: { id: params.id, workspaceId: scope.workspaceId },
      select: { id: true, userId: true },
    })
    if (!corretor) {
      return NextResponse.json({ error: 'Corretor não encontrado' }, { status: 404 })
    }

    // Corretor só vê o próprio painel (a menos que seja admin/owner)
    const isPrivileged =
      scope.isAdmin ||
      scope.isWorkspaceOwner ||
      ['owner', 'admin'].includes(scope.workspaceRole)
    if (!isPrivileged && corretor.userId !== scope.userId) {
      return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
    }

    const inicio = searchParams.get('inicio')
    const fim = searchParams.get('fim')
    const periodo = inicio && fim
      ? { inicio: new Date(inicio), fim: new Date(fim) }
      : undefined

    const data = await kpisCorretor(params.id, periodo)
    return NextResponse.json(data)
  } catch (e: any) {
    console.error('GET /api/bi/corretor/[id] error:', e)
    return NextResponse.json({ error: 'Erro ao gerar KPIs do corretor' }, { status: 500 })
  }
}
