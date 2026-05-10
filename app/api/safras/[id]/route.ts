import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const patchSchema = z.object({
  nome: z.string().min(2).optional(),
  cultura: z.enum(['soja', 'milho', 'trigo']).optional(),
  inicio: z.coerce.date().optional(),
  fim: z.coerce.date().optional(),
  ativa: z.boolean().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const data = await db.safra.findFirst({ where: { id: params.id, ...scope.whereOwn() } })
  if (!data) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = await req.json()
    const data = patchSchema.parse(body)
    const existing = await db.safra.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!existing) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
    const updated = await db.safra.update({ where: { id: params.id }, data })
    return NextResponse.json(updated)
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
    console.error('PATCH safra error', e)
    return NextResponse.json({ error: 'Erro ao atualizar safra' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const existing = await db.safra.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!existing) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  await db.safra.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
