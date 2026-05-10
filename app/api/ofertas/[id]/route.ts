/**
 * S10 M2 — GET/PATCH/DELETE de Oferta individual.
 * Multi-tenant estrito: só permite operar dentro do workspace do scope.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  precoSc: z.number().positive().optional(),
  qtdSc: z.number().positive().optional(),
  publica: z.boolean().optional(),
  status: z.enum(['aberta', 'cancelada']).optional(),
  observacao: z.string().max(1000).optional().nullable(),
})

async function loadOwn(scope: { workspaceId: string }, id: string) {
  return db.oferta.findFirst({ where: { id, workspaceId: scope.workspaceId } })
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const oferta = await loadOwn(scope, ctx.params.id)
  if (!oferta) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ oferta })
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const existing = await loadOwn(scope, ctx.params.id)
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (existing.status !== 'aberta') {
    return NextResponse.json({ error: 'oferta_imutavel', status: existing.status }, { status: 409 })
  }
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', issues: parsed.error.issues }, { status: 400 })
  }
  const oferta = await db.oferta.update({
    where: { id: existing.id },
    data: parsed.data,
  })
  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'update',
    entidade: 'oferta',
    entidadeId: oferta.id,
    mudancas: parsed.data,
  })
  return NextResponse.json({ oferta })
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const existing = await loadOwn(scope, ctx.params.id)
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  // Soft-delete: cancela. Mantém histórico.
  await db.oferta.update({ where: { id: existing.id }, data: { status: 'cancelada' } })
  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'delete',
    entidade: 'oferta',
    entidadeId: existing.id,
  })
  return NextResponse.json({ ok: true })
}
