/**
 * PATCH  /api/contratos/[id]/clausulas/[clausulaId] — edita cláusula
 * DELETE /api/contratos/[id]/clausulas/[clausulaId] — remove cláusula
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

const TIPOS = [
  'multa',
  'arbitragem',
  'foro',
  'forca_maior',
  'pagamento',
  'entrega',
  'outras',
] as const

const patchSchema = z.object({
  ordem: z.number().int().min(0).optional(),
  tipo: z.enum(TIPOS).optional(),
  titulo: z.string().min(1).optional(),
  texto: z.string().min(1).optional(),
  obrigatoria: z.boolean().optional(),
})

async function ensureScopeContract(contratoId: string, clausulaId: string) {
  const scope = await getScope()
  if (!scope) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  const cl = await db.clausulaContrato.findFirst({
    where: { id: clausulaId, contratoId, workspaceId: scope.workspaceId },
  })
  if (!cl) return { error: NextResponse.json({ error: 'not_found' }, { status: 404 }) }
  return { scope, cl }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; clausulaId: string } }
) {
  const ctx = await ensureScopeContract(params.id, params.clausulaId)
  if ('error' in ctx) return ctx.error
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const updated = await db.clausulaContrato.update({
    where: { id: params.clausulaId },
    data: parsed.data,
  })
  await logAudit({
    userId: ctx.scope.userId,
    workspaceId: ctx.scope.workspaceId,
    acao: 'update',
    entidade: 'clausula_contrato',
    entidadeId: params.clausulaId,
    mudancas: parsed.data,
  })
  return NextResponse.json({ clausula: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; clausulaId: string } }
) {
  const ctx = await ensureScopeContract(params.id, params.clausulaId)
  if ('error' in ctx) return ctx.error
  await db.clausulaContrato.delete({ where: { id: params.clausulaId } })
  await logAudit({
    userId: ctx.scope.userId,
    workspaceId: ctx.scope.workspaceId,
    acao: 'delete',
    entidade: 'clausula_contrato',
    entidadeId: params.clausulaId,
  })
  return NextResponse.json({ ok: true })
}
