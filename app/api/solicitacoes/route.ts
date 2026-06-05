/**
 * GET /api/solicitacoes — lista solicitações de cotação do workspace (mesa da corretora).
 *
 * Filtros opcionais: ?status=pendente|em_analise|convertida|recusada
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const status = searchParams.get('status') ?? undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = scope.whereOwn()
  if (status) where.status = status
  const items = await db.solicitacaoCotacao.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      cliente: { select: { id: true, nome: true, email: true, whatsapp: true } },
      proposta: { select: { id: true, numero: true, status: true, valorTotal: true } },
    },
  })
  const counts = await db.solicitacaoCotacao.groupBy({
    by: ['status'],
    where: scope.whereOwn(),
    _count: { _all: true },
  })
  return NextResponse.json({ ok: true, items, counts })
}
