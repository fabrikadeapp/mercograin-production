import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { stripe } from '@/lib/stripe/server'
import { requireScope } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const scope = await requireScope()

  const sub = await db.subscription.findUnique({
    where: { workspaceId: scope.workspaceId },
  })
  if (!sub) {
    return NextResponse.json({ error: 'sem assinatura' }, { status: 404 })
  }

  try {
    const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })

    await db.subscription.update({
      where: { workspaceId: scope.workspaceId },
      data: {
        cancelAtPeriodEnd: true,
        canceledAt: updated.canceled_at ? new Date(updated.canceled_at * 1000) : new Date(),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[stripe/cancel] error:', err)
    return NextResponse.json(
      { error: err?.message || 'stripe cancel error' },
      { status: 500 }
    )
  }
}
