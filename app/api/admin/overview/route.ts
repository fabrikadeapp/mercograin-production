import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PLANS } from '@/lib/stripe/server'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdmin()
    const [activeUsers, trialing, totalUsers, paying, subs] =
      await Promise.all([
        db.user.count({
          where: { subscription: { status: { in: ['active', 'trialing'] } } },
        }),
        db.subscription.count({ where: { status: 'trialing' } }),
        db.user.count(),
        db.user.count({ where: { subscription: { status: 'active' } } }),
        db.subscription.findMany({
          where: { status: 'active' },
          select: { plan: true },
        }),
      ])
    const mrrCents = subs.reduce(
      (acc, s) => acc + (PLANS[s.plan as keyof typeof PLANS]?.price ?? 0),
      0,
    )
    return NextResponse.json({
      activeUsers,
      trialing,
      totalUsers,
      paying,
      mrrCents,
    })
  } catch (e) {
    return adminErrorResponse(e)
  }
}
