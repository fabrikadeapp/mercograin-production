/**
 * PATCH /api/solicitacoes/[id]
 * Body: { status?, motivoRecusa? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  status: z.enum(['pendente', 'em_analise', 'convertida', 'recusada', 'cancelada']).optional(),
  motivoRecusa: z.string().max(2000).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'invalid' }, { status: 400 })
  }
  const sol = await db.solicitacaoCotacao.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!sol) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const updated = await db.solicitacaoCotacao.update({
    where: { id: sol.id },
    data: {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.motivoRecusa !== undefined ? { motivoRecusa: parsed.data.motivoRecusa } : {}),
      ...(parsed.data.status && parsed.data.status !== 'pendente'
        ? { respondidoPorId: scope.userId, respondidoEm: new Date() }
        : {}),
    },
  })
  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'update',
    entidade: 'SolicitacaoCotacao',
    entidadeId: sol.id,
    mudancas: parsed.data,
  }).catch(() => undefined)
  return NextResponse.json({ ok: true, solicitacao: updated })
}
