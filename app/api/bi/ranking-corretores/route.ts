/**
 * GET /api/bi/ranking-corretores
 * Ranking dos corretores do workspace (top N por comissão acumulada).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { rankingCorretores } from '@/lib/bi/corretor'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const scope = await getScope(searchParams)
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const top = Math.min(Math.max(parseInt(searchParams.get('top') || '10', 10), 1), 100)
    const inicio = searchParams.get('inicio')
    const fim = searchParams.get('fim')
    const periodo = inicio && fim
      ? { inicio: new Date(inicio), fim: new Date(fim) }
      : undefined

    const data = await rankingCorretores(scope.workspaceId, periodo, top)
    return NextResponse.json({ items: data })
  } catch (e: any) {
    console.error('GET /api/bi/ranking-corretores error:', e)
    return NextResponse.json({ error: 'Erro ao gerar ranking' }, { status: 500 })
  }
}
