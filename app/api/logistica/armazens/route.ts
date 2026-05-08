import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const TIPO_ENUM = z.enum(['silo', 'granel', 'horizontal', 'misto'])

const armazemSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  tipo: TIPO_ENUM,
  capacidadeSc: z.coerce.number().int().nonnegative(),
  endereco: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  uf: z.string().max(2).optional().nullable(),
  cep: z.string().optional().nullable(),
  contato: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  observacao: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
  proprio: z.boolean().optional(),
  fornecedorId: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'))
    const tipo = searchParams.get('tipo') || ''
    const ativoParam = searchParams.get('ativo')
    const q = searchParams.get('q') || ''

    const filters: Record<string, any> = {}
    if (tipo) filters.tipo = tipo
    if (ativoParam !== null && ativoParam !== '') filters.ativo = ativoParam === 'true'

    const where: any = scope.whereOwn(filters)
    if (q) {
      where.OR = [
        { nome: { contains: q, mode: 'insensitive' } },
        { cidade: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [total, data] = await Promise.all([
      db.armazem.count({ where }),
      db.armazem.findMany({
        where,
        orderBy: { nome: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          fornecedor: { select: { id: true, razaoSocial: true } },
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
    console.error('Get armazens error:', error)
    return NextResponse.json({ error: 'Erro ao buscar armazéns' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const data = armazemSchema.parse(body)

    if (data.fornecedorId) {
      const f = await db.fornecedor.findFirst({
        where: { id: data.fornecedorId, ...scope.whereOwn() },
      })
      if (!f) return NextResponse.json({ error: 'Fornecedor inválido' }, { status: 400 })
    }

    const created = await db.armazem.create({
      data: {
        nome: data.nome,
        tipo: data.tipo,
        capacidadeSc: data.capacidadeSc,
        endereco: data.endereco || null,
        cidade: data.cidade || null,
        uf: data.uf || null,
        cep: data.cep || null,
        contato: data.contato || null,
        telefone: data.telefone || null,
        observacao: data.observacao || null,
        ativo: data.ativo ?? true,
        proprio: data.proprio ?? true,
        fornecedorId: data.fornecedorId || null,
        workspaceId: scope.workspaceId,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Create armazem error:', error)
    return NextResponse.json({ error: 'Erro ao criar armazém' }, { status: 500 })
  }
}
