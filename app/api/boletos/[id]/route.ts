import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'

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
      include: {
        cliente: {
          select: {
            id: true,
            nome: true,
            cnpj: true,
            email: true,
            workspaceId: true,
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
