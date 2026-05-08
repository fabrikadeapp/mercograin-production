/**
 * GET /api/classificados — list classificados (filterable, paginated).
 * POST /api/classificados — create new classificado (auth required).
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { z } from 'zod'

const createSchema = z.object({
  tipo: z.enum(['venda', 'compra']),
  grao: z.string().min(1),
  variedade: z.string().optional().nullable(),
  safra: z.string().optional().nullable(),
  volumeSc: z.number().int().positive(),
  precoSc: z.number().positive(),
  modal: z.enum(['FOB', 'CIF']),
  cidade: z.string().min(1),
  uf: z.string().min(2).max(2),
  deltaPct: z.number().optional().nullable(),
  expiraEm: z.string().datetime().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo') || ''
    const grao = searchParams.get('grao') || ''
    const q = searchParams.get('q') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '24'))
    const skip = (page - 1) * limit

    const where: any = { status: 'ativo' }
    if (tipo && tipo !== 'todas') {
      where.tipo = tipo === 'comprar' ? 'compra' : tipo === 'vender' ? 'venda' : tipo
    }
    if (grao) where.grao = grao
    if (q) {
      where.OR = [
        { variedade: { contains: q, mode: 'insensitive' } },
        { cidade: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [total, data] = await Promise.all([
      db.classificado.count({ where }),
      db.classificado.findMany({
        where,
        include: { autor: { select: { id: true, nome: true } } },
        orderBy: { criadoEm: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return NextResponse.json({
      data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  } catch (e: any) {
    console.error('GET /classificados error:', e)
    return NextResponse.json(
      { error: 'Erro ao listar classificados' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const data = createSchema.parse(body)

    const created = await db.classificado.create({
      data: {
        ...data,
        expiraEm: data.expiraEm ? new Date(data.expiraEm) : null,
        autorId: scope.userId,
        workspaceId: scope.workspaceId,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0]?.message }, { status: 400 })
    }
    console.error('POST /classificados error:', e)
    return NextResponse.json(
      { error: 'Erro ao criar classificado' },
      { status: 500 }
    )
  }
}
