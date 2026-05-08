import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { enviarNotificacaoContrato } from '@/lib/services/email-notifications'

const updateContratoSchema = z.object({
  numero: z.string().optional(),
  dataInicio: z.string().optional(),
  dataFim: z.string().optional(),
  statusAssinatura: z.enum(['pendente', 'assinado', 'cancelado']).optional(),
})

// GET - Obter contrato específico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const contrato = await db.contrato.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: {
        cliente: true,
        proposta: {
          select: {
            numero: true,
            graos: true,
            valorTotal: true,
            tipo: true,
          },
        },
      },
    })

    if (!contrato) {
      return NextResponse.json(
        { error: 'Contrato não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(contrato)
  } catch (error) {
    console.error('Get contrato error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar contrato' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar contrato
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const contrato = await db.contrato.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })

    if (!contrato) {
      return NextResponse.json(
        { error: 'Contrato não encontrado' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const data = updateContratoSchema.parse(body)

    const updated = await db.contrato.update({
      where: { id: params.id },
      data: {
        numero: data.numero,
        dataInicio: data.dataInicio ? new Date(data.dataInicio) : undefined,
        dataFim: data.dataFim ? new Date(data.dataFim) : undefined,
        statusAssinatura: data.statusAssinatura,
      },
      include: { cliente: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Update contrato error:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar contrato' },
      { status: 500 }
    )
  }
}

// DELETE - Deletar contrato
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const contrato = await db.contrato.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })

    if (!contrato) {
      return NextResponse.json(
        { error: 'Contrato não encontrado' },
        { status: 404 }
      )
    }

    await db.contrato.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete contrato error:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar contrato' },
      { status: 500 }
    )
  }
}

// PATCH - Atualizar status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const contrato = await db.contrato.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: { cliente: true },
    })

    if (!contrato) {
      return NextResponse.json(
        { error: 'Contrato não encontrado' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { statusAssinatura } = z.object({
      statusAssinatura: z.enum(['pendente', 'assinado', 'cancelado']),
    }).parse(body)

    const updated = await db.contrato.update({
      where: { id: params.id },
      data: {
        statusAssinatura,
        assinadoEm: statusAssinatura === 'assinado' && !contrato.assinadoEm ? new Date() : undefined,
      },
      include: {
        cliente: true,
        proposta: {
          select: { numero: true },
        },
      },
    })

    if (statusAssinatura === 'assinado' && updated.cliente.email) {
      try {
        await enviarNotificacaoContrato({
          tipo: 'contrato_assinado',
          numero: updated.numero,
          proposta: updated.proposta.numero,
          email: updated.cliente.email,
        })
      } catch (emailError) {
        console.error('Erro ao enviar notificação:', emailError)
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Patch contrato error:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar contrato' },
      { status: 500 }
    )
  }
}
