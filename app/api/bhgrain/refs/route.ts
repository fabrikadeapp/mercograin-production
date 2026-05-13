/**
 * GET /api/bhgrain/refs
 *
 * Listas auxiliares para o drawer de proposta:
 *  - armazens: Armazem ativos do workspace
 *  - lotes: LoteEstoque ativos do workspace (opcionalmente filtrados por cultura)
 *
 * Query: ?cultura=soja|milho|trigo (opcional)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await requireScope(searchParams)
    const cultura = searchParams.get('cultura')?.toLowerCase() || null

    const [armazens, lotes] = await Promise.all([
      db.armazem.findMany({
        where: { workspaceId: scope.workspaceId, ativo: true },
        select: { id: true, nome: true, cidade: true, uf: true },
        orderBy: { nome: 'asc' },
        take: 200,
      }),
      db.loteEstoque.findMany({
        where: {
          workspaceId: scope.workspaceId,
          status: 'ativo',
          ...(cultura ? { cultura: { contains: cultura, mode: 'insensitive' } } : {}),
        },
        select: {
          id: true,
          numero: true,
          cultura: true,
          qtdAtualSc: true,
          armazem: { select: { nome: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      }),
    ])

    return NextResponse.json({ armazens, lotes })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const status = msg === 'Não autorizado' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
