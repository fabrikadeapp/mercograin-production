/**
 * S5 M9 — DDS detalhe + update + delete.
 */
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logAudit } from '@/lib/audit/log'

const updateSchema = z.object({
  operadorNome: z.string().min(2).optional(),
  operadorCnpj: z.string().min(11).optional(),
  operadorEndereco: z.string().min(2).optional(),
  cultura: z.string().optional(),
  ncm: z.string().optional(),
  qtdToneladas: z.number().positive().optional(),
  conclusao: z.enum(['rascunho', 'em_revisao', 'aprovada', 'rejeitada', 'enviada_ue']).optional(),
  observacoes: z.string().optional().nullable(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const dds = await db.dueDiligenceStatement.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    include: { contrato: { select: { id: true, numero: true } } },
  })
  if (!dds) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(dds)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const existing = await db.dueDiligenceStatement.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  // DDS atestada não pode mais ser editada
  if (existing.atestadoEm) {
    return NextResponse.json(
      { error: 'DDS já atestada — imutável' },
      { status: 409 },
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validação falhou', detail: parsed.error.format() }, { status: 400 })
  }

  const updated = await db.dueDiligenceStatement.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.operadorNome ? { operadorNome: parsed.data.operadorNome } : {}),
      ...(parsed.data.operadorCnpj ? { operadorCnpj: parsed.data.operadorCnpj.replace(/\D/g, '') } : {}),
      ...(parsed.data.operadorEndereco ? { operadorEndereco: parsed.data.operadorEndereco } : {}),
      ...(parsed.data.cultura ? { cultura: parsed.data.cultura } : {}),
      ...(parsed.data.ncm ? { ncm: parsed.data.ncm } : {}),
      ...(parsed.data.qtdToneladas ? { qtdToneladas: parsed.data.qtdToneladas } : {}),
      ...(parsed.data.conclusao ? { conclusao: parsed.data.conclusao } : {}),
      ...(parsed.data.observacoes !== undefined ? { observacoes: parsed.data.observacoes } : {}),
    },
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'update',
    entidade: 'dds',
    entidadeId: updated.id,
    mudancas: parsed.data,
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const existing = await db.dueDiligenceStatement.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  if (existing.atestadoEm) {
    return NextResponse.json({ error: 'DDS atestada não pode ser deletada' }, { status: 409 })
  }

  await db.dueDiligenceStatement.delete({ where: { id: existing.id } })
  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'delete',
    entidade: 'dds',
    entidadeId: existing.id,
    mudancas: { numero: existing.numero },
  })
  return NextResponse.json({ ok: true })
}
