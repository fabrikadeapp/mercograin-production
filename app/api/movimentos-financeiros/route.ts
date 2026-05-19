import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logAudit } from '@/lib/audit/log'

const schema = z.object({
  data: z.string(),
  tipo: z.enum(['receita', 'despesa', 'transferencia']),
  natureza: z.string().min(1),
  valor: z.number().positive(),
  descricao: z.string().min(1),
  centroCustoId: z.string().optional().nullable(),
  contratoId: z.string().optional().nullable(),
  boletoId: z.string().optional().nullable(),
  safraId: z.string().optional().nullable(),
  cultura: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const where: any = scope.whereOwn()
  const tipo = searchParams.get('tipo')
  const natureza = searchParams.get('natureza')
  const centroCustoId = searchParams.get('centroCustoId')
  const safraId = searchParams.get('safraId')
  const dataInicio = searchParams.get('dataInicio')
  const dataFim = searchParams.get('dataFim')

  if (tipo) where.tipo = tipo
  if (natureza) where.natureza = natureza
  if (centroCustoId) where.centroCustoId = centroCustoId
  if (safraId) where.safraId = safraId
  if (dataInicio || dataFim) {
    where.data = {}
    if (dataInicio) where.data.gte = new Date(dataInicio)
    if (dataFim) where.data.lte = new Date(dataFim)
  }

  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(200, parseInt(searchParams.get('limit') || '50'))

  const [total, data] = await Promise.all([
    db.movimentoFinanceiro.count({ where }),
    db.movimentoFinanceiro.findMany({
      where,
      include: {
        centroCusto: { select: { codigo: true, nome: true } },
        contrato: { select: { numero: true } },
        safra: { select: { nome: true, cultura: true } },
      },
      orderBy: { data: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return NextResponse.json({ data, total, page, limit })
}

export async function POST(request: NextRequest) {
  const scope = await getScope()
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const d = schema.parse(body)
    const mov = await db.movimentoFinanceiro.create({
      data: {
        workspaceId: scope.workspaceId,
        data: new Date(d.data),
        tipo: d.tipo,
        natureza: d.natureza,
        valor: d.valor,
        descricao: d.descricao,
        centroCustoId: d.centroCustoId || null,
        contratoId: d.contratoId || null,
        boletoId: d.boletoId || null,
        safraId: d.safraId || null,
        cultura: d.cultura || null,
        observacoes: d.observacoes || null,
      },
    })
    logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'movimento_create',
      entidade: 'movimento_financeiro',
      entidadeId: mov.id,
      mudancas: {
        tipo: d.tipo,
        natureza: d.natureza,
        valor: d.valor,
        data: d.data,
      },
    }).catch(() => undefined)
    return NextResponse.json(mov, { status: 201 })
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
    console.error('Create movimento error:', e)
    return NextResponse.json({ error: 'Erro ao criar' }, { status: 500 })
  }
}
