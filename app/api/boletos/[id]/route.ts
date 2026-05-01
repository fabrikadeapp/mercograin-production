import { db } from '@/lib/db'
import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'

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
      include: {
        cliente: {
          select: {
            id: true,
            nome: true,
            cnpj: true,
            email: true,
            usuarioId: true,
          },
        },
        contrato: {
          select: {
            id: true,
            numero: true,
          },
        },
      },
    })

    if (!boleto) {
      return NextResponse.json(
        { error: 'Boleto não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se o usuário é o dono do cliente
    if (boleto.cliente.usuarioId !== session.user.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar propriedade
    const boleto = await db.boleto.findUnique({
      where: { id: params.id },
      include: { cliente: true },
    })

    if (!boleto || boleto.cliente.usuarioId !== session.user.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const updated = await db.boleto.update({
      where: { id: params.id },
      data: {
        ...(body.numero && { numero: body.numero }),
        ...(body.banco && { banco: body.banco }),
        ...(body.valor !== undefined && { valor: body.valor }),
        ...(body.vencimento && { vencimento: new Date(body.vencimento) }),
        ...(body.status && { status: body.status }),
      },
      include: {
        cliente: true,
        contrato: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
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
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar propriedade
    const boleto = await db.boleto.findUnique({
      where: { id: params.id },
      include: { cliente: true },
    })

    if (!boleto || boleto.cliente.usuarioId !== session.user.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      )
    }

    // Só pode deletar boletos abertos
    if (boleto.status !== 'aberto') {
      return NextResponse.json(
        { error: 'Só é possível deletar boletos abertos' },
        { status: 400 }
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
