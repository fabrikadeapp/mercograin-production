import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isValidCPF, isValidCNPJ } from '@/lib/br/documento'
import { logAudit } from '@/lib/audit/log'

const clienteUpdateSchema = z.object({
  nome: z.string().min(3).optional(),
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  cnpj: z
    .string()
    .optional()
    .refine((v) => !v || v.length === 0 || isValidCNPJ(v), {
      message: 'CNPJ inválido',
    }),
  cpf: z
    .string()
    .optional()
    .refine((v) => !v || v.length === 0 || isValidCPF(v), {
      message: 'CPF inválido',
    }),
  endereco: z.string().optional(),
  tipo: z.enum(['comprador', 'vendedor']).optional(),
  // QW4 — campos PF/PJ
  tipoPessoa: z.enum(['PF', 'PJ']).optional(),
  dadosBancarios: z
    .object({
      banco: z.string().optional(),
      agencia: z.string().optional(),
      conta: z.string().optional(),
      tipo: z.string().optional(),
      pixChave: z.string().optional(),
    })
    .partial()
    .optional(),
  inscricaoEstadual: z.string().optional(),
  porte: z.enum(['ME', 'EPP', 'medio', 'grande']).optional(),
  origemCapital: z.enum(['nacional', 'estrangeiro']).optional(),
  scoreRelacionamento: z.number().int().min(0).max(1000).optional(),
  limiteCredito: z.number().nonnegative().optional(),
})

// GET - Buscar cliente específico
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

    const cliente = await db.cliente.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    return NextResponse.json(cliente)
  } catch (error) {
    console.error('Get cliente error:', error)
    return NextResponse.json({ error: 'Erro ao buscar cliente' }, { status: 500 })
  }
}

// PUT - Atualizar cliente
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const cliente = await db.cliente.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const data = clienteUpdateSchema.parse(body)

    const updated = await db.cliente.update({
      where: { id: params.id },
      data: data as any,
    })

    // QW2 — audit log
    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'update',
      entidade: 'cliente',
      entidadeId: updated.id,
      mudancas: { antes: cliente, depois: updated },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Update cliente error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar cliente' }, { status: 500 })
  }
}

// DELETE - Deletar cliente
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const cliente = await db.cliente.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    await db.cliente.delete({
      where: { id: params.id },
    })

    // QW2 — audit log
    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'delete',
      entidade: 'cliente',
      entidadeId: params.id,
      mudancas: { snapshot: cliente },
    })

    return NextResponse.json({ message: 'Cliente deletado com sucesso' })
  } catch (error) {
    console.error('Delete cliente error:', error)
    return NextResponse.json({ error: 'Erro ao deletar cliente' }, { status: 500 })
  }
}
