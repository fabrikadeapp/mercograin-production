import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { logAudit } from '@/lib/audit/log'

const patchSchema = z.object({
  nome: z.string().min(1).max(120).optional(),
  descricao: z.string().optional().nullable(),
  escopoTipo: z
    .enum(['global', 'cultura', 'mesa', 'corretor', 'cliente'])
    .optional()
    .nullable(),
  escopoFiltro: z.record(z.any()).optional().nullable(),
  pctTotal: z.number().min(0).max(100).optional(),
  pctCorretor: z.number().min(0).max(100).optional(),
  pctOriginador: z.number().min(0).max(100).optional().nullable(),
  pctMesa: z.number().min(0).max(100).optional().nullable(),
  pctHouse: z.number().min(0).max(100).optional().nullable(),
  ativo: z.boolean().optional(),
  prioridade: z.number().int().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const r = await db.comissaoRegra.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!r) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(r)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = patchSchema.parse(await req.json())
    const existing = await db.comissaoRegra.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!existing)
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    const updated = await db.comissaoRegra.update({
      where: { id: params.id },
      data: {
        ...(body.nome !== undefined && { nome: body.nome }),
        ...(body.descricao !== undefined && { descricao: body.descricao }),
        ...(body.escopoTipo !== undefined && { escopoTipo: body.escopoTipo }),
        ...(body.escopoFiltro !== undefined && {
          escopoFiltro: body.escopoFiltro ?? undefined,
        }),
        ...(body.pctTotal !== undefined && { pctTotal: body.pctTotal }),
        ...(body.pctCorretor !== undefined && { pctCorretor: body.pctCorretor }),
        ...(body.pctOriginador !== undefined && {
          pctOriginador: body.pctOriginador,
        }),
        ...(body.pctMesa !== undefined && { pctMesa: body.pctMesa }),
        ...(body.pctHouse !== undefined && { pctHouse: body.pctHouse }),
        ...(body.ativo !== undefined && { ativo: body.ativo }),
        ...(body.prioridade !== undefined && { prioridade: body.prioridade }),
      },
    })
    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'update',
      entidade: 'comissao_regra',
      entidadeId: updated.id,
      mudancas: body,
    })
    return NextResponse.json(updated)
  } catch (e: any) {
    if (e?.issues)
      return NextResponse.json({ error: 'Dados inválidos', issues: e.issues }, { status: 400 })
    console.error('Update comissao regra error:', e)
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const existing = await db.comissaoRegra.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!existing)
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  await db.comissaoRegra.delete({ where: { id: params.id } })
  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'delete',
    entidade: 'comissao_regra',
    entidadeId: params.id,
  })
  return NextResponse.json({ ok: true })
}
