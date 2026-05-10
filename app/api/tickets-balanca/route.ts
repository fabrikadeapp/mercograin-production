import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { nextNumero } from '@/lib/operacao-fisica/numbering'

const ticketSchema = z.object({
  numero: z.string().optional(),
  tipo: z.enum(['recepcao', 'expedicao', 'transferencia']),
  romaneioId: z.string().optional().nullable(),
  balancaId: z.string().optional().nullable(),
  loteId: z.string().optional().nullable(),
  pesoBrutoKg: z.coerce.number().nonnegative(),
  taraKg: z.coerce.number().nonnegative(),
  cultura: z.enum(['soja', 'milho', 'trigo']),
  safraId: z.string().optional().nullable(),
  classificacaoId: z.string().optional().nullable(),
  placa: z.string().optional().nullable(),
  motoristaId: z.string().optional().nullable(),
  fotoUrl: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'))
  const status = searchParams.get('status') || undefined
  const tipo = searchParams.get('tipo') || undefined
  const romaneioId = searchParams.get('romaneioId') || undefined
  const filters: any = {}
  if (status) filters.status = status
  if (tipo) filters.tipo = tipo
  if (romaneioId) filters.romaneioId = romaneioId
  const where = scope.whereOwn(filters)
  const [total, data] = await Promise.all([
    db.ticketBalanca.count({ where }),
    db.ticketBalanca.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        classificacao: true,
        balanca: { select: { id: true, nome: true } },
        romaneio: { select: { id: true, numero: true, status: true } },
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
    const data = ticketSchema.parse(body)
    if (data.pesoBrutoKg < data.taraKg) {
      return NextResponse.json({ error: 'pesoBruto < tara' }, { status: 400 })
    }
    const pesoLiquidoKg = data.pesoBrutoKg - data.taraKg
    if (data.romaneioId) {
      const r = await db.romaneio.findFirst({
        where: { id: data.romaneioId, ...scope.whereOwn() },
      })
      if (!r) return NextResponse.json({ error: 'Romaneio inválido' }, { status: 400 })
    }
    const numero = data.numero || (await nextNumero('ticket', scope.workspaceId))
    const created = await db.ticketBalanca.create({
      data: {
        numero,
        tipo: data.tipo,
        romaneioId: data.romaneioId || null,
        balancaId: data.balancaId || null,
        loteId: data.loteId || null,
        pesoBrutoKg: data.pesoBrutoKg,
        taraKg: data.taraKg,
        pesoLiquidoKg,
        cultura: data.cultura,
        safraId: data.safraId || null,
        classificacaoId: data.classificacaoId || null,
        placa: data.placa || null,
        motoristaId: data.motoristaId || null,
        fotoUrl: data.fotoUrl || null,
        observacoes: data.observacoes || null,
        status: data.classificacaoId ? 'classificado' : 'aberto',
        workspaceId: scope.workspaceId,
      },
    })
    // Quando ticket cria, e romaneio em rascunho, promove pra em_transito
    if (data.romaneioId) {
      await db.romaneio.updateMany({
        where: { id: data.romaneioId, workspaceId: scope.workspaceId, status: 'rascunho' },
        data: { status: 'em_transito' },
      })
    }
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
    if (e?.code === 'P2002')
      return NextResponse.json({ error: 'Número de ticket duplicado' }, { status: 409 })
    console.error('POST ticket error', e)
    return NextResponse.json({ error: 'Erro ao criar ticket' }, { status: 500 })
  }
}
