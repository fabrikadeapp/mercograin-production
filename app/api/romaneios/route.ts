import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { nextNumero } from '@/lib/operacao-fisica/numbering'

const romaneioSchema = z.object({
  numero: z.string().optional(),
  contratosIds: z.array(z.string()).default([]),
  motoristaId: z.string().optional().nullable(),
  origem: z.string().min(1),
  destino: z.string().min(1),
  cultura: z.enum(['soja', 'milho', 'trigo']),
  safraId: z.string().optional().nullable(),
  status: z.enum(['rascunho', 'em_transito', 'recebido', 'cancelado']).optional(),
  dataSaida: z.coerce.date().optional().nullable(),
  dataChegada: z.coerce.date().optional().nullable(),
  observacoes: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'))
  const status = searchParams.get('status') || undefined
  const cultura = searchParams.get('cultura') || undefined
  const filters: any = {}
  if (status) filters.status = status
  if (cultura) filters.cultura = cultura
  const where = scope.whereOwn(filters)
  const [total, data] = await Promise.all([
    db.romaneio.count({ where }),
    db.romaneio.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        motorista: { select: { id: true, nome: true, placa: true } },
        ticketsBalanca: { select: { id: true, numero: true, pesoLiquidoKg: true, status: true } },
      },
    }),
  ])
  return NextResponse.json({ data, total, page, limit, pages: Math.ceil(total / limit) })
}

export async function POST(request: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = await request.json()
    const data = romaneioSchema.parse(body)
    if (data.motoristaId) {
      const m = await db.motorista.findFirst({
        where: { id: data.motoristaId, ...scope.whereOwn() },
      })
      if (!m) return NextResponse.json({ error: 'Motorista inválido' }, { status: 400 })
    }
    if (data.contratosIds.length > 0) {
      const count = await db.contrato.count({
        where: { id: { in: data.contratosIds }, ...scope.whereOwn() },
      })
      if (count !== data.contratosIds.length) {
        return NextResponse.json({ error: 'Contrato(s) inválido(s)' }, { status: 400 })
      }
    }
    const numero = data.numero || (await nextNumero('romaneio', scope.workspaceId))
    const created = await db.romaneio.create({
      data: {
        numero,
        contratosIds: data.contratosIds,
        motoristaId: data.motoristaId || null,
        origem: data.origem,
        destino: data.destino,
        cultura: data.cultura,
        safraId: data.safraId || null,
        status: data.status ?? 'rascunho',
        dataSaida: data.dataSaida || null,
        dataChegada: data.dataChegada || null,
        observacoes: data.observacoes || null,
        workspaceId: scope.workspaceId,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
    if (e?.code === 'P2002')
      return NextResponse.json({ error: 'Número de romaneio duplicado' }, { status: 409 })
    console.error('POST romaneio error', e)
    return NextResponse.json({ error: 'Erro ao criar romaneio' }, { status: 500 })
  }
}
