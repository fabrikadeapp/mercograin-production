/**
 * S10 M2 — GET/DELETE individual de cenário da calculadora.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const cenario = await db.cenarioCalculadora.findFirst({
    where: { id: ctx.params.id, workspaceId: scope.workspaceId, userId: scope.userId },
  })
  if (!cenario) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ cenario })
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const cen = await db.cenarioCalculadora.findFirst({
    where: { id: ctx.params.id, workspaceId: scope.workspaceId, userId: scope.userId },
    select: { id: true },
  })
  if (!cen) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  await db.cenarioCalculadora.delete({ where: { id: cen.id } })
  return NextResponse.json({ ok: true })
}
