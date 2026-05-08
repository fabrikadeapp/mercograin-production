import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const existing = await db.alertaPreco.findFirst({
    where: scope.isAdmin
      ? { id: ctx.params.id }
      : { id: ctx.params.id, userId: scope.userId },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  }
  await db.alertaPreco.delete({ where: { id: ctx.params.id } })
  return NextResponse.json({ ok: true })
}
