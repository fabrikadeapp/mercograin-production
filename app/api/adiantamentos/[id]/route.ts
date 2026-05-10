import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const updateSchema = z.object({
  status: z.enum(['aberto', 'parcial', 'quitado', 'inadimplente']).optional(),
  observacoes: z.string().optional(),
  dataPrevistaQuit: z.string().datetime().optional(),
  qtdEsperadaSc: z.number().positive().optional(),
  valor: z.number().positive().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const data = await db.adiantamento.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    include: {
      produtor: true,
      contrato: { select: { id: true, numero: true, modalidade: true } },
      itensInsumo: true,
    },
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

    const exists = await db.adiantamento.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      select: { id: true },
    })
    if (!exists)
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    const updated = await db.adiantamento.update({
      where: { id: params.id },
      data,
    })
    return NextResponse.json(updated)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Patch adiantamento error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const exists = await db.adiantamento.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    select: { id: true, status: true },
  })
  if (!exists)
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  if (exists.status === 'parcial' || exists.status === 'quitado') {
    return NextResponse.json(
      { error: 'Não pode excluir adiantamento com abatimento' },
      { status: 400 }
    )
  }
  await db.adiantamento.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
