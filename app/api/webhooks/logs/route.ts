import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const querySchema = z.object({
  page: z.string().pipe(z.coerce.number().int().positive().default(1)),
  limit: z.string().pipe(z.coerce.number().int().positive().max(100).default(25)),
  tipo: z.enum(['tradingview', 'braspag', 'signaturely']).optional(),
  status: z.enum(['recebido', 'processado', 'erro']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

/**
 * GET /api/webhooks/logs
 * Lista logs de webhooks com paginação e filtros
 *
 * Query params:
 * - page: número da página (padrão: 1)
 * - limit: itens por página (padrão: 25, máx: 100)
 * - tipo: filtrar por tipo (tradingview, braspag, signaturely)
 * - status: filtrar por status (recebido, processado, erro)
 * - dateFrom: filtrar por data inicial (ISO string)
 * - dateTo: filtrar por data final (ISO string)
 */
export async function GET(req: NextRequest) {
  try {
    // Admin-only
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    if (!scope.isAdmin) {
      return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 })
    }

    // Parse query params
    const searchParams = req.nextUrl.searchParams
    const query = querySchema.parse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      tipo: searchParams.get('tipo'),
      status: searchParams.get('status'),
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
    })

    // Construir filtro
    const where = {
      ...(query.tipo && { tipo: query.tipo }),
      ...(query.status && { status: query.status as any }),
      ...(query.dateFrom || query.dateTo ? {
        criadoEm: {
          ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
          ...(query.dateTo && { lte: new Date(query.dateTo) }),
        },
      } : {}),
    } as any

    // Contar total
    const total = await db.webhookLog.count({ where })

    // Buscar logs com paginação
    const logs = await db.webhookLog.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    })

    const totalPages = Math.ceil(total / query.limit)

    return NextResponse.json({
      data: logs,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query params', details: error.errors },
        { status: 400 }
      )
    }

    console.error('[Webhook Logs] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
