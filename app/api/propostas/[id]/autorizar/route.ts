import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireScope } from '@/lib/auth/scope'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

const schema = z.object({
  acao: z.enum(['aprovar', 'rejeitar']),
  observacao: z.string().max(500).optional(),
})

/**
 * POST /api/propostas/{id}/autorizar
 *
 * Aprova ou rejeita uma proposta criada por canal não-web (WhatsApp,
 * telefone, IA autônoma) que está em `aguardando_autorizacao`.
 *
 *  - Aprovar: status → 'enviada', autorizadoEm=now, autorizadoPorId=membership,
 *    vendedorId=membership se ainda null.
 *  - Rejeitar: status → 'cancelada'.
 *
 * Quem autoriza precisa ter visão da Mesa (owner/admin/gerente_mesa/trader
 * dono da conta ou vendedor original). Scope já cuida disso via GET.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  let scope
  try {
    scope = await requireScope()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'invalid' },
      { status: 400 },
    )
  }
  const { acao, observacao } = parsed.data

  const proposta = await db.proposta.findFirst({
    where: { id: params.id, workspaceId: scope.workspaceId },
    select: {
      id: true,
      numero: true,
      status: true,
      vendedorId: true,
      gerenteContaId: true,
      canalAutorizacao: true,
    },
  })
  if (!proposta) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (proposta.status !== 'aguardando_autorizacao') {
    return NextResponse.json(
      { error: 'proposta_nao_pendente', currentStatus: proposta.status },
      { status: 409 },
    )
  }

  const member = await db.workspaceMember.findFirst({
    where: { workspaceId: scope.workspaceId, userId: scope.userId },
    select: { id: true },
  })

  // Visibilidade: owner/admin sempre podem; demais só se gerente da conta
  // ou vendedor original.
  const isWorkspaceAdmin =
    scope.isAdmin ||
    scope.workspaceRole === 'owner' ||
    scope.workspaceRole === 'admin'
  if (
    !isWorkspaceAdmin &&
    member?.id !== proposta.gerenteContaId &&
    member?.id !== proposta.vendedorId
  ) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const now = new Date()
  const updated = await db.proposta.update({
    where: { id: proposta.id },
    data:
      acao === 'aprovar'
        ? {
            status: 'enviada',
            autorizadoEm: now,
            autorizadoPorId: member?.id ?? null,
            // Se ainda não tinha vendedor, define como quem autorizou
            vendedorId: proposta.vendedorId ?? member?.id ?? null,
            enviadaEm: now,
          }
        : {
            status: 'cancelada',
            autorizadoEm: now,
            autorizadoPorId: member?.id ?? null,
            observacoes: observacao
              ? `[rejeitada por ${member?.id ?? scope.userId}] ${observacao}`
              : undefined,
          },
    select: {
      id: true,
      numero: true,
      status: true,
      autorizadoEm: true,
      autorizadoPorId: true,
      vendedorId: true,
      canalAutorizacao: true,
    },
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: acao === 'aprovar' ? 'proposta_autorizada' : 'proposta_rejeitada',
    entidade: 'proposta',
    entidadeId: proposta.id,
    mudancas: {
      canal: proposta.canalAutorizacao,
      observacao: observacao ?? null,
      statusAnterior: 'aguardando_autorizacao',
      statusNovo: updated.status,
    },
  }).catch(() => null)

  revalidateTag('propostas')
  return NextResponse.json({ ok: true, proposta: updated })
}
