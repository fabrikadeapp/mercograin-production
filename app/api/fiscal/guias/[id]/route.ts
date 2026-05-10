/**
 * GET / PATCH / DELETE guia por id.
 */
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const patchSchema = z.object({
  status: z.enum(['aberto', 'pago', 'cancelado']).optional(),
  multa: z.number().nonnegative().optional(),
  juros: z.number().nonnegative().optional(),
  observacoes: z.string().optional(),
  vencimento: z.string().optional(),
})

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const guia = await db.guia.findFirst({ where: { id: params.id, workspaceId: scope.workspaceId } })
  if (!guia) return NextResponse.json({ error: 'Guia não encontrada' }, { status: 404 })
  return NextResponse.json({ data: guia })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }
  const existing = await db.guia.findFirst({ where: { id: params.id, workspaceId: scope.workspaceId } })
  if (!existing) return NextResponse.json({ error: 'Guia não encontrada' }, { status: 404 })

  const updates: any = { ...parsed.data }
  if (updates.vencimento) updates.vencimento = new Date(updates.vencimento)
  // Recalcula valorTotal se multa/juros mudou
  if (updates.multa !== undefined || updates.juros !== undefined) {
    const multa = updates.multa ?? Number(existing.multa)
    const juros = updates.juros ?? Number(existing.juros)
    updates.valorTotal = Number((Number(existing.valorPrincipal) + multa + juros).toFixed(2))
  }

  const guia = await db.guia.update({ where: { id: params.id }, data: updates })

  await db.auditLog.create({
    data: {
      userId: scope.userId,
      acao: 'guia.update',
      entidade: 'Guia',
      entidadeId: guia.id,
      workspaceId: scope.workspaceId,
      mudancas: updates,
    },
  }).catch(() => {})

  return NextResponse.json({ data: guia })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const existing = await db.guia.findFirst({ where: { id: params.id, workspaceId: scope.workspaceId } })
  if (!existing) return NextResponse.json({ error: 'Guia não encontrada' }, { status: 404 })
  if (existing.status === 'pago') {
    return NextResponse.json({ error: 'Guia paga não pode ser excluída — cancele primeiro' }, { status: 409 })
  }

  await db.guia.delete({ where: { id: params.id } })

  await db.auditLog.create({
    data: {
      userId: scope.userId,
      acao: 'guia.delete',
      entidade: 'Guia',
      entidadeId: params.id,
      workspaceId: scope.workspaceId,
    },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
