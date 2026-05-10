import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logAudit } from '@/lib/audit/log'

const schema = z.object({
  nome: z.string().min(1).max(120),
  descricao: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const ativo = searchParams.get('ativo')
  const where: any = scope.whereOwn()
  if (ativo === 'true') where.ativo = true
  if (ativo === 'false') where.ativo = false
  const data = await db.mesa.findMany({
    where,
    orderBy: { nome: 'asc' },
    include: { _count: { select: { corretores: true } } },
  })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = schema.parse(await request.json())
    const created = await db.mesa.create({
      data: {
        workspaceId: scope.workspaceId,
        nome: body.nome,
        descricao: body.descricao ?? null,
        ativo: body.ativo ?? true,
      },
    })
    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'create',
      entidade: 'mesa',
      entidadeId: created.id,
      mudancas: body,
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (error?.issues)
      return NextResponse.json({ error: 'Dados inválidos', issues: error.issues }, { status: 400 })
    console.error('Create mesa error:', error)
    return NextResponse.json({ error: 'Erro ao criar mesa' }, { status: 500 })
  }
}
