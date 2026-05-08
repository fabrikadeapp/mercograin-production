import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { loadPlanMaps, sumMrrCents } from '@/lib/pricing/maps'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

interface MonthBucket {
  ym: string
  label: string
  start: Date
  end: Date
}

function lastNMonths(n: number): MonthBucket[] {
  const now = new Date()
  const buckets: MonthBucket[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    buckets.push({
      ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('pt-BR', { month: 'short' }),
      start,
      end,
    })
  }
  return buckets
}

export async function GET() {
  try {
    await requireAdmin()
    const maps = await loadPlanMaps()
    const subs = await db.subscription.findMany({
      select: {
        id: true,
        plan: true,
        status: true,
        createdAt: true,
        canceledAt: true,
      },
    })

    const activeUsers = await db.user.count({
      where: {
        workspacesOwned: {
          some: { subscription: { status: { in: ['active', 'trialing'] } } },
        },
      },
    })

    const mrrCents = subs
      .filter((s) => s.status === 'active')
      .reduce(
        (acc, s) => acc + (maps.priceCents[s.plan] ?? 0),
        0,
      )
    const arrCents = mrrCents * 12

    // 30-day churn
    const last30 = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    const canceled30 = subs.filter(
      (s) => s.canceledAt && s.canceledAt >= last30,
    ).length
    const baseAt30dAgo = subs.filter(
      (s) =>
        s.createdAt < last30 &&
        (s.status === 'active' ||
          (s.canceledAt && s.canceledAt >= last30) ||
          s.status === 'past_due'),
    ).length
    const churnRate = baseAt30dAgo ? canceled30 / baseAt30dAgo : 0

    // LTV proxy: ARPU / churn (mensal)
    const arpuCents = activeUsers ? mrrCents / activeUsers : 0
    const ltvCents = churnRate > 0 ? arpuCents / churnRate : arpuCents * 24

    // 24-month series
    const months = lastNMonths(24)
    const series = months.map((m) => {
      const subsInMonth = subs.filter(
        (s) =>
          s.createdAt < m.end &&
          (s.status === 'active' ||
            (s.canceledAt && s.canceledAt >= m.start)),
      )
      const newSubs = subs.filter(
        (s) => s.createdAt >= m.start && s.createdAt < m.end,
      )
      const churned = subs.filter(
        (s) => s.canceledAt && s.canceledAt >= m.start && s.canceledAt < m.end,
      )
      return {
        label: m.label,
        ymd: m.ym,
        mrrCents: subsInMonth.reduce(
          (acc, s) =>
            acc + (maps.priceCents[s.plan] ?? 0),
          0,
        ),
        newMrrCents: newSubs.reduce(
          (acc, s) =>
            acc + (maps.priceCents[s.plan] ?? 0),
          0,
        ),
        churnedMrrCents: churned.reduce(
          (acc, s) =>
            acc + (maps.priceCents[s.plan] ?? 0),
          0,
        ),
      }
    })

    // Receita por plano
    const byPlan = maps.slugs.map((p) => {
      const count = subs.filter((s) => s.plan === p && s.status === 'active')
        .length
      return {
        plan: p,
        count,
        mrrCents: count * (maps.priceCents[p] ?? 0),
      }
    })

    return NextResponse.json({
      mrrCents,
      arrCents,
      arpuCents: Math.round(arpuCents),
      ltvCents: Math.round(ltvCents),
      churnRate,
      activeUsers,
      series,
      byPlan,
    })
  } catch (e) {
    return adminErrorResponse(e)
  }
}
