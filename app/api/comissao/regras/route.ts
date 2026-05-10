import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { logAudit } from '@/lib/audit/log'

const schema = z.object({
  nome: z.string().min(1).max(120),
  descricao: z.string().optional().nullable(),
  escopoTipo: z.enum(['global', 'cultura', 'mesa', 'corretor', 'cliente']).optional().nullable(),
  escopoFiltro: z.record(z.any()).optional().nullable(),
  pctTotal: z.number().min(0).max(100),
  pctCorretor: z.number().min(0).max(100),
  pctOriginador: z.number().min(0).max(100).optional().nullable(),
  pctMesa: z.number().min(0).max(100).optional().nullable(),
  pctHouse: z.number().min(0).max(100).optional().nullable(),
  ativo: z.boolean().optional(),
  prioridade: z.number().int().optional(),
})

export async function GET(request: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const ativo = searchParams.get('ativo')
  const where: any = scope.whereOwn()
  if (ativo === 'true') where.ativo = true
  if (ativo === 'false') where.ativo = false
  const data = await db.comissaoRegra.findMany({
    where,
    orderBy: [{ prioridade: 'desc' }, { nome: 'asc' }],
  })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = schema.parse(await request.json())
    const created = await db.comissaoRegra.create({
      data: {
        workspaceId: scope.workspaceId,
        nome: body.nome,
        descricao: body.descricao ?? null,
        escopoTipo: body.escopoTipo ?? null,
        escopoFiltro: body.escopoFiltro ?? undefined,
        pctTotal: body.pctTotal,
        pctCorretor: body.pctCorretor,
        pctOriginador: body.pctOriginador ?? null,
        pctMesa: body.pctMesa ?? null,
        pctHouse: body.pctHouse ?? null,
        ativo: body.ativo ?? true,
        prioridade: body.prioridade ?? 0,
      },
    })
    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'create',
      entidade: 'comissao_regra',
      entidadeId: created.id,
      mudancas: body,
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    if (e?.issues)
      return NextResponse.json({ error: 'Dados inválidos', issues: e.issues }, { status: 400 })
    console.error('Create comissao regra error:', e)
    return NextResponse.json({ error: 'Erro ao criar regra' }, { status: 500 })
  }
}
