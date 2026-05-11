import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
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

    const boleto = await db.boleto.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: { cliente: true },
    })

    if (!boleto) {
      return NextResponse.json(
        { error: 'Boleto não encontrado' },
        { status: 404 }
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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const boleto = await db.boleto.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })

    if (!boleto) {
      return NextResponse.json(
        { error: 'Boleto não encontrado' },
        { status: 404 }
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const boleto = await db.boleto.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })

    if (!boleto) {
      return NextResponse.json(
        { error: 'Boleto não encontrado' },
        { status: 404 }
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const boleto = await db.boleto.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })

    if (!boleto) {
      return NextResponse.json(
        { error: 'Boleto não encontrado' },
        { status: 404 }
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
