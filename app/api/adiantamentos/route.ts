import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const adiantamentoSchema = z.object({
  numero: z.string().min(1),
  contratoId: z.string().min(1),
  produtorId: z.string().min(1),
  valor: z.number().positive(),
  tipo: z.enum(['dinheiro', 'insumo', 'misto']),
  qtdEsperadaSc: z.number().positive(),
  dataAdiantamento: z.string().datetime().optional(),
  dataPrevistaQuit: z.string().datetime().optional(),
  observacoes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope)
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const status = searchParams.get('status') || ''
    const contratoId = searchParams.get('contratoId') || ''
    const produtorId = searchParams.get('produtorId') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '25'))
    const skip = (page - 1) * limit

    const where: any = scope.whereOwn()
    if (status) where.status = status
    if (contratoId) where.contratoId = contratoId
    if (produtorId) where.produtorId = produtorId

    const [total, data] = await Promise.all([
      db.adiantamento.count({ where }),
      db.adiantamento.findMany({
        where,
        include: {
          produtor: { select: { id: true, nome: true, cnpj: true } },
          contrato: { select: { id: true, numero: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
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
    console.error('Get adiantamentos error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar adiantamentos' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope)
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const data = adiantamentoSchema.parse(await request.json())

    // Validar ownership do contrato e produtor
    const [contrato, produtor] = await Promise.all([
      db.contrato.findFirst({
        where: { id: data.contratoId, ...scope.whereOwn() },
      }),
      db.cliente.findFirst({
        where: { id: data.produtorId, ...scope.whereOwn() },
      }),
    ])

    if (!contrato)
      return NextResponse.json(
        { error: 'Contrato não encontrado' },
        { status: 404 }
      )
    if (!produtor)
      return NextResponse.json(
        { error: 'Produtor não encontrado' },
        { status: 404 }
      )

    const created = await db.adiantamento.create({
      data: {
        workspaceId: scope.workspaceId,
        numero: data.numero,
        contratoId: data.contratoId,
        produtorId: data.produtorId,
        valor: data.valor,
        tipo: data.tipo,
        qtdEsperadaSc: data.qtdEsperadaSc,
        dataAdiantamento: data.dataAdiantamento
          ? new Date(data.dataAdiantamento)
          : new Date(),
        dataPrevistaQuit: data.dataPrevistaQuit
          ? new Date(data.dataPrevistaQuit)
          : null,
        observacoes: data.observacoes,
        status: 'aberto',
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Número de adiantamento já existe' },
        { status: 409 }
      )
    }
    console.error('Create adiantamento error:', error)
    return NextResponse.json(
      { error: 'Erro ao criar adiantamento' },
      { status: 500 }
    )
  }
}
