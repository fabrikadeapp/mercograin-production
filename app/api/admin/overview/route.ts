import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { loadPlanMaps, sumMrrCents } from '@/lib/pricing/maps'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdmin()
    const [activeUsers, trialing, totalUsers, paying, subs, maps] =
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
        loadPlanMaps(),
      ])
    const mrrCents = sumMrrCents(subs, maps)
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
