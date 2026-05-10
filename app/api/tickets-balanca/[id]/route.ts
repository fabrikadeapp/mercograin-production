import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const patchSchema = z.object({
  pesoBrutoKg: z.coerce.number().nonnegative().optional(),
  taraKg: z.coerce.number().nonnegative().optional(),
  classificacaoId: z.string().optional().nullable(),
  fotoUrl: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  status: z.enum(['aberto', 'classificado', 'finalizado']).optional(),
  loteId: z.string().optional().nullable(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const data = await db.ticketBalanca.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    include: { classificacao: true, romaneio: true, balanca: true },
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
    const existing = await db.ticketBalanca.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    const novoBruto = data.pesoBrutoKg ?? existing.pesoBrutoKg
    const novaTara = data.taraKg ?? existing.taraKg
    if (novoBruto < novaTara)
      return NextResponse.json({ error: 'pesoBruto < tara' }, { status: 400 })
    const pesoLiquidoKg = novoBruto - novaTara
    const updated = await db.ticketBalanca.update({
      where: { id: params.id },
      data: { ...data, pesoLiquidoKg },
    })
    return NextResponse.json(updated)
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
    console.error('PATCH ticket', e)
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const existing = await db.ticketBalanca.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  if (existing.status === 'finalizado')
    return NextResponse.json({ error: 'Ticket finalizado' }, { status: 409 })
  await db.ticketBalanca.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
