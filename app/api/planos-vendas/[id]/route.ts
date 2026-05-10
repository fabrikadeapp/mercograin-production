import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const updateSchema = z.object({
  qtdPrevistaSc: z.number().positive().optional(),
  precoMedioPrevistoSc: z.number().positive().optional(),
  observacoes: z.string().optional(),
  status: z.enum(['ativo', 'concluido', 'cancelado']).optional(),
})

export async function GET(
  _r: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const data = await db.planoVendas.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    include: { safra: true },
  })
  if (!data)
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope)
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const data = updateSchema.parse(await request.json())
    const exists = await db.planoVendas.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      select: { id: true },
    })
    if (!exists)
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    const updated = await db.planoVendas.update({
      where: { id: params.id },
      data,
    })
    return NextResponse.json(updated)
  } catch (error: any) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    console.error('Patch plano error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })
  }
}

export async function DELETE(
  _r: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const exists = await db.planoVendas.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    select: { id: true },
  })
  if (!exists)
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  await db.planoVendas.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
