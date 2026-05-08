import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const existing = await db.alertaPreco.findUnique({ where: { id: ctx.params.id } })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  if (existing.userId !== session.user.id) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  await db.alertaPreco.delete({ where: { id: ctx.params.id } })
  return NextResponse.json({ ok: true })
}
