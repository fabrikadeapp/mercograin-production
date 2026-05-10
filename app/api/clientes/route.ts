import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isValidCPF, isValidCNPJ } from '@/lib/br/documento'

const cpfRefinement = z
  .string()
  .optional()
  .refine(
    (v) => !v || v.length === 0 || isValidCPF(v),
    { message: 'CPF inválido' }
  )

const cnpjRefinement = z
  .string()
  .optional()
  .refine(
    (v) => !v || v.length === 0 || isValidCNPJ(v),
    { message: 'CNPJ inválido' }
  )

const clienteSchema = z.object({
  nome: z.string().min(3),
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  cnpj: cnpjRefinement,
  cpf: cpfRefinement,
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  tipo: z.enum(['comprador', 'vendedor']),
})

// GET - Listar clientes (com paginação e filtros)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Query params para paginação e filtros
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '25'))
    const search = searchParams.get('search') || ''
    const tipo = searchParams.get('tipo') || ''
    const ativo = searchParams.get('ativo')

    const skip = (page - 1) * limit

    // Construir where clause com filtros
    const where: any = scope.whereOwn()
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { cnpj: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (tipo) {
      where.tipo = tipo
    }
    if (ativo !== null && ativo !== undefined) {
      where.ativo = ativo === 'true'
    }

    // Buscar total e dados
    const [total, clientes] = await Promise.all([
      db.cliente.count({ where }),
      db.cliente.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return NextResponse.json({
      data: clientes,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Get clientes error:', error)
    return NextResponse.json({ error: 'Erro ao buscar clientes' }, { status: 500 })
  }
}

// POST - Criar cliente
export async function POST(request: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const data = clienteSchema.parse(body)

    const cliente = await db.cliente.create({
      data: {
        ...data,
        workspaceId: scope.workspaceId,
      },
    })

    return NextResponse.json(cliente, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Create cliente error:', error)
    return NextResponse.json({ error: 'Erro ao criar cliente' }, { status: 500 })
  }
}
