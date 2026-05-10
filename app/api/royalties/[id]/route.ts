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
  const r = await db.royalty.findFirst({ where: { id, ...scope.whereOwn() } })
  if (!r) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const body = await request.json()
  const updated = await db.royalty.update({
    where: { id },
    data: {
      status: body.status ?? r.status,
      pagoEm:
        body.status === 'pago' && !r.pagoEm ? new Date() : r.pagoEm,
    },
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
  const r = await db.royalty.findFirst({ where: { id, ...scope.whereOwn() } })
  if (!r) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  await db.royalty.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
