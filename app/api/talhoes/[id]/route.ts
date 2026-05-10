import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const scope = await getScope()
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const t = await db.talhao.findFirst({ where: { id, ...scope.whereOwn() } })
  if (!t) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  const body = await request.json()
  const updated = await db.talhao.update({
    where: { id },
    data: { ...body },
  })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const scope = await getScope()
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const t = await db.talhao.findFirst({ where: { id, ...scope.whereOwn() } })
  if (!t) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  await db.talhao.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
