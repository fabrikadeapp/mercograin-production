import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const patchSchema = z.object({
  nome: z.string().min(2).optional(),
  modelo: z.string().optional().nullable(),
  fabricante: z.string().optional().nullable(),
  armazemId: z.string().optional().nullable(),
  capacidadeMaxKg: z.coerce.number().int().positive().optional(),
  precisaoKg: z.coerce.number().int().positive().optional(),
  tipoIntegracao: z.enum(['manual', 'serial', 'tcp', 'api']).optional(),
  enderecoIntegracao: z.string().optional().nullable(),
  ativa: z.boolean().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const data = await db.balanca.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    include: { armazem: { select: { id: true, nome: true } } },
  })
  if (!data) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = await req.json()
    const data = patchSchema.parse(body)
    const existing = await db.balanca.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!existing) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
    const updated = await db.balanca.update({ where: { id: params.id }, data })
    return NextResponse.json(updated)
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
    console.error('PATCH balanca error', e)
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const existing = await db.balanca.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!existing) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  await db.balanca.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
