import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'))
    const entidade = searchParams.get('entidade') || ''
    const acao = searchParams.get('acao') || ''

    const skip = (page - 1) * limit

    // AuditLog usa userId; admin com ?scope=all vê tudo
    const where: any =
      scope.isAdmin && searchParams.get('scope') === 'all'
        ? {}
        : { userId: scope.userId }

    if (entidade) {
      where.entidade = entidade
    }

    if (acao) {
      where.acao = acao
    }

    // Buscar total e dados
    const [total, logs] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return NextResponse.json({
      data: logs,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Get audit logs error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar logs de auditoria' },
      { status: 500 }
    )
  }
}
