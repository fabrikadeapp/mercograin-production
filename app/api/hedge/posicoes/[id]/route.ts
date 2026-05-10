import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const patchSchema = z.object({
  status: z.enum(['aberta', 'fechada', 'rolada', 'liquidada']).optional(),
  observacoes: z.string().optional(),
  margemDepositadaUSD: z.number().nonnegative().optional(),
  margemDepositadaBRL: z.number().nonnegative().optional(),
  corretagemUSD: z.number().nonnegative().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const pos = await db.posicaoHedge.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    include: {
      contratoOrigem: { select: { id: true, numero: true } },
      marcacoes: { orderBy: { data: 'desc' }, take: 60 },
    },
  })
  if (!pos) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  return NextResponse.json(pos)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const data = patchSchema.parse(await request.json())
  const pos = await db.posicaoHedge.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!pos) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

  const updated = await db.posicaoHedge.update({
    where: { id: pos.id },
    data,
  })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const pos = await db.posicaoHedge.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!pos) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

  await db.posicaoHedge.delete({ where: { id: pos.id } })
  return NextResponse.json({ ok: true })
}
