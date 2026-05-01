import { db } from '@/lib/db'
import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const contratoSchema = z.object({
  proposIdFk: z.string().min(1),
  clienteId: z.string().min(1),
  numero: z.string().min(1),
  descricao: z.string().optional(),
  valor: z.number().positive(),
})

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
    const statusAssinatura = searchParams.get('statusAssinatura') || ''
    const clienteId = searchParams.get('clienteId') || ''

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
    if (statusAssinatura) {
      where.statusAssinatura = statusAssinatura
    }
    if (clienteId) {
      where.clienteId = clienteId
    }

    // Buscar total e dados
    const [total, contratos] = await Promise.all([
      db.contrato.count({ where }),
      db.contrato.findMany({
        where,
        include: {
          cliente: {
            select: { id: true, nome: true },
          },
        },
        orderBy: { criadoEm: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return NextResponse.json({
      data: contratos,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Get contratos error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar contratos' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const data = contratoSchema.parse(body)

    const cliente = await db.cliente.findUnique({
      where: { id: data.clienteId },
    })

    if (!cliente || cliente.usuarioId !== session.user.id) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      )
    }

    const contrato = await db.contrato.create({
      data: {
        ...data,
        dataInicio: new Date(),
        statusAssinatura: 'pendente',
      },
      include: { cliente: true },
    })

    return NextResponse.json(contrato, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Create contrato error:', error)
    return NextResponse.json(
      { error: 'Erro ao criar contrato' },
      { status: 500 }
    )
  }
}
