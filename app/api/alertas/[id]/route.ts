import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

const patchSchema = z.object({
  operador: z.enum(['>', '<']).optional(),
  preco: z.number().positive().optional(),
  status: z.enum(['ativo', 'inativo']).optional(),
})

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const existing = await db.alertaPreco.findFirst({ where: scope.whereOwn({ id: ctx.params.id }) })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  await db.alertaPreco.update({
    where: { id: ctx.params.id },
    data: {
      ...(parsed.data.operador ? { operador: parsed.data.operador } : {}),
      ...(parsed.data.preco != null ? { preco: parsed.data.preco } : {}),
      // reativar zera o disparo anterior
      ...(parsed.data.status ? { status: parsed.data.status, ...(parsed.data.status === 'ativo' ? { notifEnviadoEm: null } : {}) } : {}),
    },
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const existing = await db.alertaPreco.findFirst({
    where: scope.whereOwn({ id: ctx.params.id }),
  })
  if (!existing) {
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  }
  await db.alertaPreco.delete({ where: { id: ctx.params.id } })
  return NextResponse.json({ ok: true })
}
