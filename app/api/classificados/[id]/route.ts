/**
 * GET / PUT / DELETE /api/classificados/[id]
 * Auth required. Ownership enforced (autor === session.user.id) for write ops.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const updateSchema = z.object({
  tipo: z.enum(['venda', 'compra']).optional(),
  grao: z.string().min(1).optional(),
  variedade: z.string().nullable().optional(),
  safra: z.string().nullable().optional(),
  volumeSc: z.number().int().positive().optional(),
  precoSc: z.number().positive().optional(),
  modal: z.enum(['FOB', 'CIF']).optional(),
  cidade: z.string().min(1).optional(),
  uf: z.string().min(2).max(2).optional(),
  deltaPct: z.number().nullable().optional(),
  status: z.enum(['ativo', 'pausado', 'fechado']).optional(),
  expiraEm: z.string().datetime().nullable().optional(),
})

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const item = await db.classificado.findUnique({
    where: { id: ctx.params.id },
    include: { autor: { select: { id: true, nome: true } } },
  })
  if (!item) {
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  }
  return NextResponse.json(item)
}

export async function PUT(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const existing = await db.classificado.findUnique({
      where: { id: ctx.params.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    }
    if (existing.autorId !== session.user.id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const data = updateSchema.parse(body)
    const updated = await db.classificado.update({
      where: { id: ctx.params.id },
      data: {
        ...data,
        expiraEm:
          data.expiraEm === null
            ? null
            : data.expiraEm
              ? new Date(data.expiraEm)
              : undefined,
      },
    })
    return NextResponse.json(updated)
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0]?.message }, { status: 400 })
    }
    console.error('PUT /classificados/[id] error:', e)
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const existing = await db.classificado.findUnique({
    where: { id: ctx.params.id },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  }
  if (existing.autorId !== session.user.id) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  await db.classificado.delete({ where: { id: ctx.params.id } })
  return NextResponse.json({ ok: true })
}
