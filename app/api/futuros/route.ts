import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { codigoVencimento } from '@/lib/futuros/codigos'

export const dynamic = 'force-dynamic'

const futuroSchema = z.object({
  grao: z.enum(['soja', 'milho', 'trigo', 'sorgo']),
  lado: z.enum(['compra', 'venda']),
  vencimento: z.string().min(7), // YYYY-MM-DD ou YYYY-MM
  precoSc: z.coerce.number().positive(),
  volumeSc: z.coerce.number().int().positive(),
  praca: z.string().optional().nullable(),
  observacao: z.string().optional().nullable(),
  clienteId: z.string().optional().nullable(),
  status: z.enum(['ativo', 'executado', 'cancelado']).optional(),
})

function parseVencimento(s: string): Date {
  // Aceita YYYY-MM-DD ou YYYY-MM (assume dia 15 quando faltar)
  const parts = s.split('-')
  const y = Number(parts[0])
  const m = Number(parts[1] || 1) - 1
  const d = Number(parts[2] || 15)
  return new Date(Date.UTC(y, m, d))
}

// GET — lista paginada com filtros
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'))
    const skip = (page - 1) * limit

    const grao = searchParams.get('grao')
    const status = searchParams.get('status')
    const lado = searchParams.get('lado')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: any = scope.whereOwn()
    if (grao) where.grao = grao
    if (status) where.status = status
    if (lado) where.lado = lado
    if (from || to) {
      where.vencimento = {}
      if (from) where.vencimento.gte = parseVencimento(from)
      if (to) where.vencimento.lte = parseVencimento(to)
    }

    const [total, rows] = await Promise.all([
      db.contratoFuturo.count({ where }),
      db.contratoFuturo.findMany({
        where,
        orderBy: [{ vencimento: 'asc' }, { criadoEm: 'desc' }],
        include: { cliente: { select: { id: true, nome: true } } },
        skip,
        take: limit,
      }),
    ])

    return NextResponse.json({
      data: rows,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[futuros] GET erro:', error)
    return NextResponse.json(
      { error: 'Erro ao listar contratos futuros' },
      { status: 500 },
    )
  }
}

// POST — cria contrato futuro
export async function POST(req: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const data = futuroSchema.parse(body)
    const venc = parseVencimento(data.vencimento)

    // Se clienteId foi passado, valida ownership
    if (data.clienteId) {
      const cli = await db.cliente.findFirst({
        where: { id: data.clienteId, ...scope.whereOwn() },
        select: { id: true },
      })
      if (!cli) {
        return NextResponse.json(
          { error: 'Cliente inválido' },
          { status: 400 },
        )
      }
    }

    const created = await db.contratoFuturo.create({
      data: {
        workspaceId: scope.workspaceId,
        grao: data.grao,
        lado: data.lado,
        vencimento: venc,
        precoSc: data.precoSc,
        volumeSc: data.volumeSc,
        codigoVenc: codigoVencimento(venc),
        praca: data.praca || null,
        observacao: data.observacao || null,
        clienteId: data.clienteId || null,
        status: data.status || 'ativo',
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 },
      )
    }
    console.error('[futuros] POST erro:', error)
    return NextResponse.json(
      { error: 'Erro ao criar contrato futuro' },
      { status: 500 },
    )
  }
}
