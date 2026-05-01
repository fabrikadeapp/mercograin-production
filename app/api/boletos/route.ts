import { db } from '@/lib/db'
import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getBraspagClient } from '@/lib/braspag-client'
import { Decimal } from '@prisma/client/runtime/library'

const boletoSchema = z.object({
  clienteId: z.string().min(1),
  contratoId: z.string().optional(), // Contrato de origem (opcional)
  numero: z.string().min(1),
  banco: z.string().min(1),
  valor: z.number().positive(),
  vencimento: z.string(),
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
    const status = searchParams.get('status') || ''
    const banco = searchParams.get('banco') || ''
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
    if (status) {
      where.status = status
    }
    if (banco) {
      where.banco = banco
    }
    if (clienteId) {
      where.clienteId = clienteId
    }

    // Buscar total e dados
    const [total, boletos] = await Promise.all([
      db.boleto.count({ where }),
      db.boleto.findMany({
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
      data: boletos,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Get boletos error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar boletos' },
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
    const data = boletoSchema.parse(body)

    const cliente = await db.cliente.findUnique({
      where: { id: data.clienteId },
    })

    if (!cliente || cliente.usuarioId !== session.user.id) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      )
    }

    // Validar contrato se fornecido
    if (data.contratoId) {
      const contrato = await db.contrato.findUnique({
        where: { id: data.contratoId },
        include: { cliente: true },
      })

      if (!contrato || contrato.clienteId !== data.clienteId) {
        return NextResponse.json(
          { error: 'Contrato não encontrado ou não pertence a este cliente' },
          { status: 404 }
        )
      }
    }

    // Chamar Braspag para gerar boleto real
    let braspagResponse = null
    let linkBoleto = null
    let braspagId = null

    try {
      const braspagClient = getBraspagClient()
      const cpfCnpj = cliente.cnpj || ''
      const email = cliente.email || ''

      braspagResponse = await braspagClient.createBoleto({
        merchantOrderId: data.numero,
        numero: data.numero,
        valor: Number(data.valor),
        vencimento: new Date(data.vencimento),
        cliente: {
          nome: cliente.nome,
          email: email || undefined,
          cpf: cliente.cnpj ? undefined : cpfCnpj, // Se tem CNPJ, não enviar CPF
          cnpj: cliente.cnpj ? cpfCnpj : undefined,
        },
        beneficiario: {
          banco: data.banco,
          agencia: process.env.BRASPAG_BENEFICIARY_AGENCY || '0001',
          conta: process.env.BRASPAG_BENEFICIARY_ACCOUNT || '1234567',
          nome: process.env.BRASPAG_BENEFICIARY_NAME || 'MercoGrain LTDA',
        },
      })

      linkBoleto = braspagResponse?.link
      braspagId = braspagResponse?.id
    } catch (braspagError) {
      console.error('[Boleto API] Erro ao chamar Braspag:', braspagError)
      // Continua sem link de boleto (fallback), será preenchido depois via webhook
    }

    // Criar boleto no banco de dados
    const boleto = await db.boleto.create({
      data: {
        numero: data.numero,
        clienteId: data.clienteId,
        contratoIdFk: data.contratoId,
        banco: data.banco,
        valor: new Decimal(data.valor),
        vencimento: new Date(data.vencimento),
        status: 'aberto',
        linkBoleto: linkBoleto || null,
        braspagId: braspagId || null,
      },
      include: { cliente: true },
    })

    return NextResponse.json(boleto, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Create boleto error:', error)
    return NextResponse.json(
      { error: 'Erro ao criar boleto' },
      { status: 500 }
    )
  }
}
