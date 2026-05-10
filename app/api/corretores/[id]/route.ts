import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logAudit } from '@/lib/audit/log'

const schema = z.object({
  nome: z.string().min(1).max(120).optional(),
  email: z.string().email().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  cpf: z.string().optional().nullable(),
  mesaId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  comissaoPct: z.number().min(0).max(100).optional(),
  comissaoOriginadorPct: z.number().min(0).max(100).optional().nullable(),
  ativo: z.boolean().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const corretor = await db.corretor.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    include: { mesa: true, user: { select: { id: true, email: true, nome: true } } },
  })
  if (!corretor) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(corretor)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = schema.parse(await req.json())
    const found = await db.corretor.findFirst({ where: { id: params.id, ...scope.whereOwn() } })
    if (!found) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    const updated = await db.corretor.update({ where: { id: params.id }, data: body })
    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'update',
      entidade: 'corretor',
      entidadeId: params.id,
      mudancas: { antes: found, depois: body },
    })
    return NextResponse.json(updated)
  } catch (error: any) {
    if (error?.issues)
      return NextResponse.json({ error: 'Dados inválidos', issues: error.issues }, { status: 400 })
    console.error('Update corretor error:', error)
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const found = await db.corretor.findFirst({ where: { id: params.id, ...scope.whereOwn() } })
  if (!found) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  await db.corretor.delete({ where: { id: params.id } })
  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'delete',
    entidade: 'corretor',
    entidadeId: params.id,
  })
  return NextResponse.json({ ok: true })
}
