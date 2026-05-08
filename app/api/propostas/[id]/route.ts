import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { enviarNotificacaoProposta } from '@/lib/services/email-notifications'

const updatePropostaSchema = z.object({
  numero: z.string().optional(),
  tipo: z.enum(['venda', 'compra']).optional(),
  graos: z.array(z.object({
    grao: z.string(),
    quantidade: z.number().positive(),
    preco: z.number().positive(),
    subtotal: z.number().positive(),
  })).optional(),
  valor: z.number().optional(),
  descricao: z.string().optional(),
  validadeEm: z.string().optional(),
})

const statusUpdateSchema = z.object({
  status: z.enum(['rascunho', 'enviada', 'aceita', 'rejeitada']),
})

// GET - Obter proposta específica
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

    const proposta = await db.proposta.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: { cliente: true },
    })

    if (!proposta) {
      return NextResponse.json(
        { error: 'Proposta não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(proposta)
  } catch (error) {
    console.error('Get proposta error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar proposta' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar proposta completa
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const proposta = await db.proposta.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: { cliente: true },
    })

    if (!proposta) {
      return NextResponse.json(
        { error: 'Proposta não encontrada' },
        { status: 404 }
      )
    }

    if (proposta.status !== 'rascunho') {
      return NextResponse.json(
        { error: 'Apenas propostas em rascunho podem ser editadas' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const data = updatePropostaSchema.parse(body)

    const updated = await db.proposta.update({
      where: { id: params.id },
      data: {
        numero: data.numero,
        tipo: data.tipo,
        ...(data.graos && { graos: data.graos as never }),
        valorTotal: data.valor ? String(data.valor) : proposta.valorTotal,
        descricao: data.descricao,
        validadeEm: data.validadeEm ? new Date(data.validadeEm) : proposta.validadeEm,
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

    console.error('Update proposta error:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar proposta' },
      { status: 500 }
    )
  }
}

// DELETE - Deletar proposta
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const proposta = await db.proposta.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })

    if (!proposta) {
      return NextResponse.json(
        { error: 'Proposta não encontrada' },
        { status: 404 }
      )
    }

    if (proposta.status !== 'rascunho') {
      return NextResponse.json(
        { error: 'Apenas propostas em rascunho podem ser deletadas' },
        { status: 400 }
      )
    }

    await db.proposta.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete proposta error:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar proposta' },
      { status: 500 }
    )
  }
}

// PATCH - Atualizar apenas status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const proposta = await db.proposta.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: { cliente: true },
    })

    if (!proposta) {
      return NextResponse.json(
        { error: 'Proposta não encontrada' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { status } = statusUpdateSchema.parse(body)

    const updated = await db.proposta.update({
      where: { id: params.id },
      data: {
        status,
        enviadaEm: status === 'enviada' && !proposta.enviadaEm ? new Date() : proposta.enviadaEm,
      },
      include: { cliente: true },
    })

    // Enviar notificação por email
    if (updated.cliente.email) {
      const notificacaoTipo =
        status === 'aceita' ? 'proposta_aceita' :
        status === 'rejeitada' ? 'proposta_rejeitada' :
        status === 'enviada' ? 'proposta_enviada' : null

      if (notificacaoTipo) {
        try {
          await enviarNotificacaoProposta({
            tipo: notificacaoTipo,
            numero: updated.numero,
            cliente: updated.cliente.nome,
            valor: Number(updated.valorTotal || 0),
            email: updated.cliente.email,
          })
        } catch (emailError) {
          console.error('Erro ao enviar notificação:', emailError)
        }
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

    console.error('Update status error:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar status' },
      { status: 500 }
    )
  }
}
