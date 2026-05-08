import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { codigoVencimento } from '@/lib/futuros/codigos'

export const dynamic = 'force-dynamic'

const futuroUpdateSchema = z.object({
  grao: z.enum(['soja', 'milho', 'trigo', 'sorgo']).optional(),
  lado: z.enum(['compra', 'venda']).optional(),
  vencimento: z.string().min(7).optional(),
  precoSc: z.coerce.number().positive().optional(),
  volumeSc: z.coerce.number().int().positive().optional(),
  praca: z.string().optional().nullable(),
  observacao: z.string().optional().nullable(),
  clienteId: z.string().optional().nullable(),
  status: z.enum(['ativo', 'executado', 'cancelado']).optional(),
})

function parseVencimento(s: string): Date {
  const parts = s.split('-')
  const y = Number(parts[0])
  const m = Number(parts[1] || 1) - 1
  const d = Number(parts[2] || 15)
  return new Date(Date.UTC(y, m, d))
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { searchParams } = new URL(req.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const row = await db.contratoFuturo.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: { cliente: { select: { id: true, nome: true } } },
    })
    if (!row) {
      return NextResponse.json(
        { error: 'Contrato futuro não encontrado' },
        { status: 404 },
      )
    }
    return NextResponse.json(row)
  } catch (error) {
    console.error('[futuros/:id] GET erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar contrato futuro' },
      { status: 500 },
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const existing = await db.contratoFuturo.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Contrato futuro não encontrado' },
        { status: 404 },
      )
    }

    const body = await req.json()
    const data = futuroUpdateSchema.parse(body)

    if (data.clienteId) {
      const cli = await db.cliente.findFirst({
        where: { id: data.clienteId, ...scope.whereOwn() },
        select: { id: true },
      })
      if (!cli) {
        return NextResponse.json(
          { error: 'Cliente inválido' },
          { status: 400 },
        )
      }
    }

    const updateData: any = { ...data }
    if (data.vencimento) {
      const v = parseVencimento(data.vencimento)
      updateData.vencimento = v
      updateData.codigoVenc = codigoVencimento(v)
    }

    const updated = await db.contratoFuturo.update({
      where: { id: params.id },
      data: updateData,
    })
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 },
      )
    }
    console.error('[futuros/:id] PUT erro:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar contrato futuro' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const existing = await db.contratoFuturo.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Contrato futuro não encontrado' },
        { status: 404 },
      )
    }

    await db.contratoFuturo.delete({ where: { id: params.id } })
    return NextResponse.json({ message: 'Contrato futuro removido' })
  } catch (error) {
    console.error('[futuros/:id] DELETE erro:', error)
    return NextResponse.json(
      { error: 'Erro ao remover contrato futuro' },
      { status: 500 },
    )
  }
}
