import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { enviarNotificacaoContrato } from '@/lib/services/email-notifications'

const contratoSchema = z.object({
  proposIdFk: z.string().min(1),
  clienteId: z.string().min(1),
  numero: z.string().min(1),
  descricao: z.string().optional(),
  valor: z.number().positive(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '25'))
    const search = searchParams.get('search') || ''
    const statusAssinatura = searchParams.get('statusAssinatura') || ''
    const clienteId = searchParams.get('clienteId') || ''

    const skip = (page - 1) * limit

    // Multi-tenancy via Contrato.usuarioId
    const where: any = scope.whereOwn()

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
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const data = contratoSchema.parse(body)

    const cliente = await db.cliente.findFirst({
      where: { id: data.clienteId, ...scope.whereOwn() },
    })

    if (!cliente) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      )
    }

    // Validar que a proposta também pertence ao usuário
    const proposta = await db.proposta.findFirst({
      where: { id: data.proposIdFk, ...scope.whereOwn() },
    })

    if (!proposta) {
      return NextResponse.json(
        { error: 'Proposta não encontrada' },
        { status: 404 }
      )
    }

    const contrato = await db.contrato.create({
      data: {
        proposIdFk: data.proposIdFk,
        clienteId: data.clienteId,
        numero: data.numero,
        usuarioId: scope.userId,
        dataInicio: new Date(),
        statusAssinatura: 'pendente',
      },
      include: {
        cliente: true,
        proposta: {
          select: { numero: true },
        },
      },
    })

    if (cliente.email) {
      try {
        await enviarNotificacaoContrato({
          tipo: 'contrato_criado',
          numero: contrato.numero,
          proposta: contrato.proposta.numero,
          email: cliente.email,
        })
      } catch (emailError) {
        console.error('Erro ao enviar notificação:', emailError)
      }
    }

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
