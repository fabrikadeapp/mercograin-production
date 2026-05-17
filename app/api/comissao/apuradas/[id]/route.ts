import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { db } from '@/lib/db'
import { requireScope } from '@/lib/auth/scope'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  status: z.enum(['apurada', 'paga', 'cancelada']).optional(),
  observacao: z.string().max(500).optional(),
})

/**
 * PATCH /api/comissao/apuradas/{id}
 *
 * Marca comissão como paga / cancelada / re-apurada.
 * Apenas owner/admin/admin global do workspace podem.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  let scope
  try {
    scope = await requireScope()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const isAdminWs =
    scope.isAdmin ||
    scope.workspaceRole === 'owner' ||
    scope.workspaceRole === 'admin'
  if (!isAdminWs) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'invalid' },
      { status: 400 },
    )
  }

  const comissao = await db.comissaoApurada.findFirst({
    where: { id: params.id, workspaceId: scope.workspaceId },
  })
  if (!comissao) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const updated = await db.comissaoApurada.update({
    where: { id: comissao.id },
    data: {
      status: parsed.data.status ?? comissao.status,
      pagaEm:
        parsed.data.status === 'paga'
          ? new Date()
          : parsed.data.status === 'apurada'
            ? null
            : comissao.pagaEm,
    },
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'comissao_status_update',
    entidade: 'comissao_apurada',
    entidadeId: comissao.id,
    mudancas: {
      statusAnterior: comissao.status,
      statusNovo: updated.status,
      observacao: parsed.data.observacao ?? null,
    },
  }).catch(() => null)

  revalidateTag('comissoes')

  return NextResponse.json({ ok: true, comissao: updated })
}
