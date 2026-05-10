import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const ndf = await db.nDF.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!ndf) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  return NextResponse.json(ndf)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const ndf = await db.nDF.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!ndf) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  await db.nDF.delete({ where: { id: ndf.id } })
  return NextResponse.json({ ok: true })
}
