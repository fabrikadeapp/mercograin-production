import { db } from '@/lib/db'
import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const updateBoletoSchema = z.object({
  numero: z.string().optional(),
  banco: z.string().optional(),
  valor: z.number().optional(),
  vencimento: z.string().optional(),
  status: z.enum(['aberto', 'pago', 'vencido', 'cancelado']).optional(),
  linkBoleto: z.string().url().optional(),
  braspagId: z.string().optional(),
})

// GET - Obter boleto específico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const boleto = await db.boleto.findUnique({
      where: { id: params.id },
      include: { cliente: true },
    })

    if (!boleto) {
      return NextResponse.json(
        { error: 'Boleto não encontrado' },
        { status: 404 }
      )
    }

    const cliente = await db.cliente.findUnique({
      where: { id: boleto.clienteId },
    })

    if (!cliente || cliente.usuarioId !== session.user.id) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    return NextResponse.json(boleto)
  } catch (error) {
    console.error('Get boleto error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar boleto' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar boleto
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const boleto = await db.boleto.findUnique({
      where: { id: params.id },
      include: { cliente: true },
    })

    if (!boleto) {
      return NextResponse.json(
        { error: 'Boleto não encontrado' },
        { status: 404 }
      )
    }

    if (boleto.cliente.usuarioId !== session.user.id) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = updateBoletoSchema.parse(body)

    const updated = await db.boleto.update({
      where: { id: params.id },
      data: {
        numero: data.numero,
        banco: data.banco,
        valor: data.valor ? String(data.valor) : undefined,
        vencimento: data.vencimento ? new Date(data.vencimento) : undefined,
        status: data.status,
        linkBoleto: data.linkBoleto,
        braspagId: data.braspagId,
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

    console.error('Update boleto error:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar boleto' },
      { status: 500 }
    )
  }
}

// DELETE - Deletar boleto
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const boleto = await db.boleto.findUnique({
      where: { id: params.id },
      include: { cliente: true },
    })

    if (!boleto) {
      return NextResponse.json(
        { error: 'Boleto não encontrado' },
        { status: 404 }
      )
    }

    if (boleto.cliente.usuarioId !== session.user.id) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    await db.boleto.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete boleto error:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar boleto' },
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
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const boleto = await db.boleto.findUnique({
      where: { id: params.id },
      include: { cliente: true },
    })

    if (!boleto) {
      return NextResponse.json(
        { error: 'Boleto não encontrado' },
        { status: 404 }
      )
    }

    if (boleto.cliente.usuarioId !== session.user.id) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { status } = z.object({
      status: z.enum(['aberto', 'pago', 'vencido', 'cancelado']),
    }).parse(body)

    const updated = await db.boleto.update({
      where: { id: params.id },
      data: { status },
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

    console.error('Patch boleto error:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar boleto' },
      { status: 500 }
    )
  }
}
