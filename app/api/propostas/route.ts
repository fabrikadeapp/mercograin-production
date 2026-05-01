import { db } from '@/lib/db'
import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const propostaSchema = z.object({
  clienteId: z.string().min(1),
  numero: z.string().min(1),
  tipo: z.enum(['venda', 'compra']),
  assunto: z.string().min(3),
  descricao: z.string().optional(),
  valor: z.number().positive(),
  graos: z.array(z.object({
    grao: z.string(),
    quantidade: z.number().positive(),
    preco: z.number().positive(),
    subtotal: z.number().positive(),
  })).default([]),
  validadeEm: z.string(),
})

// GET - Listar propostas (com paginação e filtros)
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Query params para paginação e filtros
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '25'))
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const clienteId = searchParams.get('clienteId') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''

    const skip = (page - 1) * limit

    // Construir where clause com filtros
    const where: any = {
      cliente: {
        usuarioId: session.user.id,
      },
    }

    if (search) {
      where.OR = [
        { numero: { contains: search, mode: 'insensitive' } },
        { cliente: { nome: { contains: search, mode: 'insensitive' } } },
      ]
    }
    if (status) {
      where.status = status
    }
    if (clienteId) {
      where.clienteId = clienteId
    }
    if (dateFrom || dateTo) {
      where.validadeEm = {}
      if (dateFrom) {
        where.validadeEm.gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.validadeEm.lte = new Date(dateTo)
      }
    }

    // Buscar total e dados
    const [total, propostas] = await Promise.all([
      db.proposta.count({ where }),
      db.proposta.findMany({
        where,
        include: {
          cliente: {
            select: { id: true, nome: true },
          },
        },
        orderBy: { criadaEm: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return NextResponse.json({
      data: propostas,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Get propostas error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar propostas' },
      { status: 500 }
    )
  }
}

// POST - Criar proposta
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const data = propostaSchema.parse(body)

    // Verificar se cliente pertence ao usuário
    const cliente = await db.cliente.findUnique({
      where: { id: data.clienteId },
    })

    if (!cliente || cliente.usuarioId !== session.user.id) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      )
    }

    const proposta = await db.proposta.create({
      data: {
        numero: data.numero,
        clienteId: data.clienteId,
        tipo: data.tipo,
        graos: data.graos,
        valorTotal: String(data.valor),
        status: 'rascunho',
        descricao: data.descricao,
        validadeEm: new Date(data.validadeEm),
      },
      include: { cliente: true },
    })

    return NextResponse.json(proposta, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Create proposta error:', error)
    return NextResponse.json(
      { error: 'Erro ao criar proposta' },
      { status: 500 }
    )
  }
}
