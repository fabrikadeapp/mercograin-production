import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireScope } from '@/lib/auth/scope'
import { logAudit } from '@/lib/audit/log'
import { PROPOSTA_STATUS } from '@/lib/propostas/status'

export const dynamic = 'force-dynamic'

const schema = z.object({
  acao: z.enum(['aprovar', 'rejeitar']),
  observacao: z.string().max(500).optional(),
})

/**
 * POST /api/propostas/{id}/autorizar — "VISTO" DA MESA
 *
 * NÃO CONFUNDIR COM /api/bhgrain/propostas/[id]/aprovar:
 *   - `autorizar`  → visto humano em proposta criada por Laura/IA/canal
 *                    externo. Confirma que pode ser enviada ao cliente.
 *                    Status: aguardando_autorizacao → enviada (ou cancelada).
 *   - `aprovar`    → fluxo de Aprovacao (CommercialRule). Quando uma regra
 *                    comercial é violada, o envio entra em workflow de
 *                    aprovação multi-etapa. Status: pendente_aprovacao →
 *                    pronta_para_enviar.
 *
 * Estados que entram em "autorizar":
 *   - aguardando_autorizacao (criada por Laura/WhatsApp/telefone)
 *
 * Estados resultantes:
 *   - aprovar  → enviada (+ enviadaEm + autorizadoEm + vendedorId)
 *   - rejeitar → cancelada (+ autorizadoEm + observacoes)
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
  if (proposta.status !== PROPOSTA_STATUS.AGUARDANDO_AUTORIZACAO) {
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
            status: PROPOSTA_STATUS.ENVIADA,
            autorizadoEm: now,
            autorizadoPorId: member?.id ?? null,
            // Se ainda não tinha vendedor, define como quem autorizou
            vendedorId: proposta.vendedorId ?? member?.id ?? null,
            enviadaEm: now,
          }
        : {
            status: PROPOSTA_STATUS.CANCELADA,
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
