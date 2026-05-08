import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const motoristaSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  cpf: z.string().optional().nullable(),
  cnh: z.string().optional().nullable(),
  cnhCategoria: z.string().max(5).optional().nullable(),
  telefone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  placa: z.string().max(10).optional().nullable(),
  veiculo: z.string().optional().nullable(),
  capacidadeSc: z.coerce.number().int().nonnegative().optional().nullable(),
  transportadoraId: z.string().optional().nullable(),
  observacao: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'))
    const transportadoraId = searchParams.get('transportadoraId') || ''
    const ativoParam = searchParams.get('ativo')
    const q = searchParams.get('q') || ''

    const filters: Record<string, any> = {}
    if (transportadoraId) filters.transportadoraId = transportadoraId
    if (ativoParam !== null && ativoParam !== '') filters.ativo = ativoParam === 'true'

    const where: any = scope.whereOwn(filters)
    if (q) {
      where.OR = [
        { nome: { contains: q, mode: 'insensitive' } },
        { cpf: { contains: q, mode: 'insensitive' } },
        { placa: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [total, data] = await Promise.all([
      db.motorista.count({ where }),
      db.motorista.findMany({
        where,
        orderBy: { nome: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          transportadora: { select: { id: true, razaoSocial: true } },
        },
      }),
    ])

    return NextResponse.json({
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Get motoristas error:', error)
    return NextResponse.json({ error: 'Erro ao buscar motoristas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const data = motoristaSchema.parse(body)

    if (data.transportadoraId) {
      const f = await db.fornecedor.findFirst({
        where: { id: data.transportadoraId, ...scope.whereOwn() },
      })
      if (!f) return NextResponse.json({ error: 'Transportadora inválida' }, { status: 400 })
    }

    const created = await db.motorista.create({
      data: {
        nome: data.nome,
        cpf: data.cpf || null,
        cnh: data.cnh || null,
        cnhCategoria: data.cnhCategoria || null,
        telefone: data.telefone || null,
        whatsapp: data.whatsapp || null,
        email: data.email ? data.email : null,
        placa: data.placa || null,
        veiculo: data.veiculo || null,
        capacidadeSc: data.capacidadeSc ?? null,
        transportadoraId: data.transportadoraId || null,
        observacao: data.observacao || null,
        ativo: data.ativo ?? true,
        workspaceId: scope.workspaceId,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Create motorista error:', error)
    return NextResponse.json({ error: 'Erro ao criar motorista' }, { status: 500 })
  }
}
