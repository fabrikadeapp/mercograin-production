import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getBraspagClient } from '@/lib/braspag-client'
import { Decimal } from '@prisma/client/runtime/library'
import { sendEmail } from '@/lib/email/send'
import { boletoGeneratedTemplate } from '@/lib/email/templates/boleto-generated'
import { logAudit } from '@/lib/audit/log'

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
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Query params para paginação e filtros
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '25'))
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const banco = searchParams.get('banco') || ''
    const clienteId = searchParams.get('clienteId') || ''

    const skip = (page - 1) * limit

    // Multi-tenancy via Boleto.workspaceId
    const where: any = scope.whereOwn()

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
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const data = boletoSchema.parse(body)

    const cliente = await db.cliente.findFirst({
      where: { id: data.clienteId, ...scope.whereOwn() },
    })

    if (!cliente) {
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
          // Sem fallback hardcoded — exige env explícita em prod
          agencia: process.env.BRASPAG_BENEFICIARY_AGENCY ?? '',
          conta: process.env.BRASPAG_BENEFICIARY_ACCOUNT ?? '',
          nome: process.env.BRASPAG_BENEFICIARY_NAME ?? '',
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
        workspaceId: scope.workspaceId,
        banco: data.banco,
        valor: new Decimal(data.valor),
        vencimento: new Date(data.vencimento),
        status: 'aberto',
        linkBoleto: linkBoleto || null,
        braspagId: braspagId || null,
      },
      include: { cliente: true },
    })

    // QW2 — audit log
    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'create',
      entidade: 'boleto',
      entidadeId: boleto.id,
      mudancas: {
        numero: boleto.numero,
        clienteId: boleto.clienteId,
        valor: Number(boleto.valor),
        vencimento: boleto.vencimento,
        braspagId,
      },
    })

    // Notifica pagador (best-effort).
    if (boleto.cliente?.email && linkBoleto) {
      try {
        const tpl = boletoGeneratedTemplate({
          payerName: boleto.cliente.nome,
          valor: Number(boleto.valor),
          vencimento: boleto.vencimento,
          linkBoleto,
          numero: boleto.numero,
        })
        await sendEmail({
          to: boleto.cliente.email,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
        })
      } catch (emailError) {
        console.error('Erro ao enviar notificação boleto_gerado:', emailError)
      }
    }

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
