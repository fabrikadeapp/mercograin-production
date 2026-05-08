import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stripe } from '@/lib/stripe/server'
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
      return NextResponse.json(
        { error: 'no_subscription' },
        { status: 404 },
      )
    }

    // Cancela imediatamente no Stripe
    try {
      await stripe.subscriptions.cancel(sub.stripeSubscriptionId)
    } catch (e) {
      console.warn('[admin/suspend] stripe cancel failed', e)
    }

    await db.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'canceled',
        canceledAt: new Date(),
        cancelAtPeriodEnd: true,
      },
    })

    await db.auditLog.create({
      data: {
        userId: admin.id,
        acao: 'admin_cancelar_assinatura',
        entidade: 'subscription',
        entidadeId: sub.id,
        mudancas: { targetUserId: params.id },
      },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return adminErrorResponse(e)
  }
}
