import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const patchSchema = z.object({
  status: z.enum(['ativo', 'consumido', 'transferido']).optional(),
  umidadeMedia: z.coerce.number().optional().nullable(),
  impurezaMedia: z.coerce.number().optional().nullable(),
  armazemId: z.string().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const data = await db.loteEstoque.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    include: {
      armazem: { select: { id: true, nome: true } },
      safra: { select: { id: true, nome: true } },
      movimentacoes: { orderBy: { createdAt: 'desc' }, take: 200 },
    },
  })
  if (!data) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = await req.json()
    const data = patchSchema.parse(body)
    const existing = await db.loteEstoque.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    const updated = await db.loteEstoque.update({ where: { id: params.id }, data })
    return NextResponse.json(updated)
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
    console.error('PATCH lote', e)
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const existing = await db.loteEstoque.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  await db.loteEstoque.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
