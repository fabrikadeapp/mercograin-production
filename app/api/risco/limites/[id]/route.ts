import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logAudit } from '@/lib/audit/log'

const schema = z.object({
  escopo: z.string().optional(),
  escopoFiltro: z.record(z.any()).optional().nullable(),
  tipo: z.string().optional(),
  valorMaximo: z.number().positive().optional(),
  valorAviso: z.number().positive().optional().nullable(),
  ativo: z.boolean().optional(),
  observacao: z.string().optional().nullable(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const limite = await db.limiteRisco.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    include: {
      breaches: { orderBy: { detectadoEm: 'desc' }, take: 20 },
    },
  })
  if (!limite) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(limite)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = schema.parse(await req.json())
    const found = await db.limiteRisco.findFirst({ where: { id: params.id, ...scope.whereOwn() } })
    if (!found) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    const updated = await db.limiteRisco.update({ where: { id: params.id }, data: body as any })
    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'update',
      entidade: 'limite_risco',
      entidadeId: params.id,
      mudancas: { antes: found, depois: body },
    })
    return NextResponse.json(updated)
  } catch (error: any) {
    if (error?.issues)
      return NextResponse.json({ error: 'Dados inválidos', issues: error.issues }, { status: 400 })
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const found = await db.limiteRisco.findFirst({ where: { id: params.id, ...scope.whereOwn() } })
  if (!found) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  await db.limiteRisco.delete({ where: { id: params.id } })
  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'delete',
    entidade: 'limite_risco',
    entidadeId: params.id,
  })
  return NextResponse.json({ ok: true })
}
