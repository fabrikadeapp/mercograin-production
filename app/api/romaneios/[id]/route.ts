import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const patchSchema = z.object({
  contratosIds: z.array(z.string()).optional(),
  motoristaId: z.string().optional().nullable(),
  origem: z.string().min(1).optional(),
  destino: z.string().min(1).optional(),
  cultura: z.enum(['soja', 'milho', 'trigo']).optional(),
  safraId: z.string().optional().nullable(),
  status: z.enum(['rascunho', 'em_transito', 'recebido', 'cancelado']).optional(),
  dataSaida: z.coerce.date().optional().nullable(),
  dataChegada: z.coerce.date().optional().nullable(),
  observacoes: z.string().optional().nullable(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const data = await db.romaneio.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    include: {
      motorista: true,
      safra: true,
      ticketsBalanca: {
        orderBy: { createdAt: 'asc' },
        include: { classificacao: true, balanca: { select: { id: true, nome: true } } },
      },
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
    const existing = await db.romaneio.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    const updated = await db.romaneio.update({ where: { id: params.id }, data })
    return NextResponse.json(updated)
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
    console.error('PATCH romaneio', e)
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const existing = await db.romaneio.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  await db.romaneio.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
