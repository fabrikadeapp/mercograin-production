import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logAudit } from '@/lib/audit/log'

const escopos = ['total', 'cultura', 'corretor', 'mesa', 'contraparte', 'regiao'] as const
const tipos = [
  'exposicao_usd',
  'exposicao_brl',
  'qtd_sc',
  'var_usd',
  'pnl_neg_usd',
] as const

const schema = z.object({
  escopo: z.enum(escopos),
  escopoFiltro: z.record(z.any()).optional().nullable(),
  tipo: z.enum(tipos),
  valorMaximo: z.number().positive(),
  valorAviso: z.number().positive().optional().nullable(),
  ativo: z.boolean().optional(),
  observacao: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const ativo = searchParams.get('ativo')
  const where: any = scope.whereOwn()
  if (ativo === 'true') where.ativo = true
  if (ativo === 'false') where.ativo = false
  const data = await db.limiteRisco.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { breaches: true } } },
  })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = schema.parse(await request.json())
    const created = await db.limiteRisco.create({
      data: {
        workspaceId: scope.workspaceId,
        escopo: body.escopo,
        escopoFiltro: (body.escopoFiltro ?? undefined) as any,
        tipo: body.tipo,
        valorMaximo: body.valorMaximo,
        valorAviso: body.valorAviso ?? null,
        ativo: body.ativo ?? true,
        observacao: body.observacao ?? null,
      },
    })
    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'create',
      entidade: 'limite_risco',
      entidadeId: created.id,
      mudancas: body,
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (error?.issues)
      return NextResponse.json({ error: 'Dados inválidos', issues: error.issues }, { status: 400 })
    console.error('Create limite error:', error)
    return NextResponse.json({ error: 'Erro ao criar limite' }, { status: 500 })
  }
}
