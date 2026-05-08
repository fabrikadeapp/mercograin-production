import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const admin = await requireAdmin()
    const ws = await db.workspace.findFirst({
      where: { ownerId: params.id },
      orderBy: { createdAt: 'asc' },
    })
    const sub = ws
      ? await db.subscription.findUnique({ where: { workspaceId: ws.id } })
      : null
    if (!sub) {
      return NextResponse.json({ error: 'no_subscription' }, { status: 404 })
    }
    // Reativação real exige novo checkout — aqui apenas removemos cancelAtPeriodEnd
    // se a sub ainda estiver dentro do período pago.
    await db.subscription.update({
      where: { id: sub.id },
      data: { cancelAtPeriodEnd: false },
    })
    await db.auditLog.create({
      data: {
        userId: admin.id,
        acao: 'admin_reativar_assinatura',
        entidade: 'subscription',
        entidadeId: sub.id,
        mudancas: { targetUserId: params.id },
      },
    })
    return NextResponse.json({
      ok: true,
      note: 'cancelAtPeriodEnd removido. Para reativar pós-cancel, instrua o usuário a refazer checkout.',
    })
  } catch (e) {
    return adminErrorResponse(e)
  }
}
