import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isValidCNPJ } from '@/lib/br/documento'

const TIPO_ENUM = z.enum([
  'transportadora',
  'armazem',
  'insumos',
  'certificadora',
  'outros',
])

const fornecedorSchema = z.object({
  tipo: TIPO_ENUM,
  razaoSocial: z.string().min(2, 'Razão social obrigatória'),
  nomeFantasia: z.string().optional().nullable(),
  cnpj: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || v.length === 0 || isValidCNPJ(v), {
      message: 'CNPJ inválido',
    }),
  contato: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  endereco: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  uf: z.string().max(2).optional().nullable(),
  observacao: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
  metadata: z.record(z.any()).optional().nullable(),
})

// GET - lista paginada de fornecedores
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '20'))
    const tipo = searchParams.get('tipo') || ''
    const q = searchParams.get('q') || ''
    const ativoParam = searchParams.get('ativo')

    const skip = (page - 1) * limit

    const filters: Record<string, any> = {}
    if (tipo) filters.tipo = tipo
    if (ativoParam !== null && ativoParam !== '') {
      filters.ativo = ativoParam === 'true'
    }

    const where: any = scope.whereOwn(filters)
    if (q) {
      where.OR = [
        { razaoSocial: { contains: q, mode: 'insensitive' } },
        { nomeFantasia: { contains: q, mode: 'insensitive' } },
        { cnpj: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [total, data, counts] = await Promise.all([
      db.fornecedor.count({ where }),
      db.fornecedor.findMany({
        where,
        orderBy: { razaoSocial: 'asc' },
        skip,
        take: limit,
      }),
      // Counts by tipo (sem filtro de tipo/q/ativo)
      db.fornecedor.groupBy({
        by: ['tipo'],
        where: scope.whereOwn(),
        _count: { _all: true },
      }),
    ])

    const totalAtivos = await db.fornecedor.count({
      where: scope.whereOwn({ ativo: true }),
    })

    const totalGeral = await db.fornecedor.count({
      where: scope.whereOwn(),
    })

    const byTipo: Record<string, number> = {}
    for (const c of counts) byTipo[c.tipo] = c._count._all

    return NextResponse.json({
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      counts: {
        all: totalGeral,
        ativos: totalAtivos,
        byTipo,
      },
    })
  } catch (error) {
    console.error('Get fornecedores error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar fornecedores' },
      { status: 500 }
    )
  }
}

// POST - cria fornecedor
export async function POST(request: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const data = fornecedorSchema.parse(body)

    const created = await db.fornecedor.create({
      data: {
        tipo: data.tipo,
        razaoSocial: data.razaoSocial,
        nomeFantasia: data.nomeFantasia || null,
        cnpj: data.cnpj || null,
        contato: data.contato || null,
        telefone: data.telefone || null,
        email: data.email ? data.email : null,
        endereco: data.endereco || null,
        cidade: data.cidade || null,
        uf: data.uf || null,
        observacao: data.observacao || null,
        ativo: data.ativo ?? true,
        metadata: (data.metadata as any) ?? undefined,
        workspaceId: scope.workspaceId,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Create fornecedor error:', error)
    return NextResponse.json(
      { error: 'Erro ao criar fornecedor' },
      { status: 500 }
    )
  }
}
