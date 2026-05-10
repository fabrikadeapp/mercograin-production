import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const ENTIDADES = [
  'contrato',
  'fixacao',
  'washout',
  'adiantamento',
  'nf_emissao',
] as const

const etapaSchema = z.object({
  ordem: z.number().int().positive(),
  role: z.string().min(1),
  nome: z.string().min(1),
})

const condicaoSchema = z.object({
  valorMinimo: z.number().nonnegative().optional(),
  qtdMinimaSc: z.number().nonnegative().optional(),
  sempre: z.boolean().optional(),
})

const workflowSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional(),
  entidade: z.enum(ENTIDADES),
  condicao: condicaoSchema,
  etapas: z.array(etapaSchema).min(1),
  slaHoras: z.number().int().positive().default(48),
  ativo: z.boolean().default(true),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const where: any = scope.whereOwn()
  const entidade = searchParams.get('entidade')
  if (entidade) where.entidade = entidade

  const data = await db.aprovacaoWorkflow.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const scope = await getScope()
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!scope.isAdmin && !scope.isWorkspaceOwner && scope.workspaceRole !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const data = workflowSchema.parse(body)

    const wf = await db.aprovacaoWorkflow.create({
      data: {
        workspaceId: scope.workspaceId,
        nome: data.nome,
        descricao: data.descricao,
        entidade: data.entidade,
        condicao: data.condicao,
        etapas: data.etapas,
        slaHoras: data.slaHoras,
        ativo: data.ativo,
      },
    })
    return NextResponse.json(wf, { status: 201 })
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
    }
    console.error('Create workflow error:', e)
    return NextResponse.json({ error: 'Erro ao criar workflow' }, { status: 500 })
  }
}
