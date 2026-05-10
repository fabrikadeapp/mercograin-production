import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logAudit } from '@/lib/audit/log'

const schema = z.object({
  nome: z.string().min(1).max(120),
  email: z.string().email().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  cpf: z.string().optional().nullable(),
  mesaId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  comissaoPct: z.number().min(0).max(100).optional(),
  comissaoOriginadorPct: z.number().min(0).max(100).optional().nullable(),
  ativo: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const ativo = searchParams.get('ativo')
  const mesaId = searchParams.get('mesaId')
  const where: any = scope.whereOwn()
  if (ativo === 'true') where.ativo = true
  if (ativo === 'false') where.ativo = false
  if (mesaId) where.mesaId = mesaId
  const data = await db.corretor.findMany({
    where,
    orderBy: { nome: 'asc' },
    include: {
      mesa: { select: { id: true, nome: true } },
      user: { select: { id: true, email: true, nome: true } },
    },
  })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = schema.parse(await request.json())
    if (body.mesaId) {
      const m = await db.mesa.findFirst({ where: { id: body.mesaId, ...scope.whereOwn() } })
      if (!m) return NextResponse.json({ error: 'Mesa não encontrada no workspace' }, { status: 400 })
    }
    const created = await db.corretor.create({
      data: {
        workspaceId: scope.workspaceId,
        nome: body.nome,
        email: body.email ?? null,
        whatsapp: body.whatsapp ?? null,
        cpf: body.cpf ?? null,
        mesaId: body.mesaId ?? null,
        userId: body.userId ?? null,
        comissaoPct: body.comissaoPct ?? 0.5,
        comissaoOriginadorPct: body.comissaoOriginadorPct ?? null,
        ativo: body.ativo ?? true,
      },
    })
    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'create',
      entidade: 'corretor',
      entidadeId: created.id,
      mudancas: body,
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (error?.issues)
      return NextResponse.json({ error: 'Dados inválidos', issues: error.issues }, { status: 400 })
    if (error?.code === 'P2002')
      return NextResponse.json({ error: 'CPF já cadastrado no workspace' }, { status: 409 })
    console.error('Create corretor error:', error)
    return NextResponse.json({ error: 'Erro ao criar corretor' }, { status: 500 })
  }
}
