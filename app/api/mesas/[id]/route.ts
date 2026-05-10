import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logAudit } from '@/lib/audit/log'

const schema = z.object({
  nome: z.string().min(1).max(120).optional(),
  descricao: z.string().nullable().optional(),
  ativo: z.boolean().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const mesa = await db.mesa.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    include: { corretores: { where: { ativo: true } } },
  })
  if (!mesa) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  return NextResponse.json(mesa)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = schema.parse(await req.json())
    const found = await db.mesa.findFirst({ where: { id: params.id, ...scope.whereOwn() } })
    if (!found) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
    const updated = await db.mesa.update({ where: { id: params.id }, data: body })
    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'update',
      entidade: 'mesa',
      entidadeId: params.id,
      mudancas: { antes: found, depois: body },
    })
    return NextResponse.json(updated)
  } catch (error: any) {
    if (error?.issues)
      return NextResponse.json({ error: 'Dados inválidos', issues: error.issues }, { status: 400 })
    console.error('Update mesa error:', error)
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const found = await db.mesa.findFirst({ where: { id: params.id, ...scope.whereOwn() } })
  if (!found) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  await db.mesa.delete({ where: { id: params.id } })
  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'delete',
    entidade: 'mesa',
    entidadeId: params.id,
  })
  return NextResponse.json({ ok: true })
}
