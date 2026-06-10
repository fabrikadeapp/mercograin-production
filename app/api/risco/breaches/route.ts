import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!(await isFeatureEnabled(scope.workspaceId, 'hedge')))
    return NextResponse.json({ error: 'feature_disabled' }, { status: 403 })
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'aberto' // 'aberto'|'resolvido'|'todos'
  const severidade = searchParams.get('severidade') || ''
  const where: any = scope.whereOwn()
  if (status === 'aberto') where.resolvidoEm = null
  if (status === 'resolvido') where.resolvidoEm = { not: null }
  if (severidade) where.severidade = severidade
  const data = await db.limiteBreach.findMany({
    where,
    orderBy: { detectadoEm: 'desc' },
    take: 200,
    include: { limite: true },
  })
  return NextResponse.json({ data })
}
