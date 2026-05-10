import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  contratoId: z.string().min(1),
  detentorId: z.string().min(1),
  cultivar: z.string().min(1),
  qtdSc: z.number().positive(),
  valorPorSc: z.number().positive(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const where: any = scope.whereOwn()
  const status = searchParams.get('status')
  if (status) where.status = status

  const data = await db.royalty.findMany({
    where,
    include: {
      contrato: { select: { numero: true } },
      detentor: { select: { razaoSocial: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const scope = await getScope()
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const d = schema.parse(body)
    const valorTotal = d.qtdSc * d.valorPorSc

    const contrato = await db.contrato.findFirst({
      where: { id: d.contratoId, ...scope.whereOwn() },
    })
    if (!contrato)
      return NextResponse.json({ error: 'Contrato inválido' }, { status: 404 })

    const detentor = await db.fornecedor.findFirst({
      where: { id: d.detentorId, ...scope.whereOwn() },
    })
    if (!detentor)
      return NextResponse.json({ error: 'Detentor inválido' }, { status: 404 })

    const r = await db.royalty.create({
      data: {
        workspaceId: scope.workspaceId,
        contratoId: d.contratoId,
        detentorId: d.detentorId,
        cultivar: d.cultivar,
        qtdSc: d.qtdSc,
        valorPorSc: d.valorPorSc,
        valorTotal,
        status: 'apurado',
      },
    })
    return NextResponse.json(r, { status: 201 })
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
    console.error('Royalty create error:', e)
    return NextResponse.json({ error: 'Erro ao criar' }, { status: 500 })
  }
}
