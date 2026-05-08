import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { loadPlanMaps } from '@/lib/pricing/maps'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? 'all'
    const plan = searchParams.get('plan') ?? 'all'
    const q = searchParams.get('q')?.trim() ?? ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get('limit') ?? '25', 10) || 25),
    )

    const where: Prisma.SubscriptionWhereInput = {}
    if (status !== 'all') where.status = status
    if (plan !== 'all') where.plan = plan
    if (q) {
      where.OR = [
        { stripeCustomerId: { contains: q } },
        { stripeSubscriptionId: { contains: q } },
        { workspace: { owner: { email: { contains: q, mode: 'insensitive' } } } },
        { workspace: { owner: { nome: { contains: q, mode: 'insensitive' } } } },
      ]
    }

    const [subs, total, maps] = await Promise.all([
      db.subscription.findMany({
        where,
        include: {
          workspace: {
            include: {
              owner: { select: { id: true, nome: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.subscription.count({ where }),
      loadPlanMaps(),
    ])

    return NextResponse.json({
      data: subs.map((s) => ({
        ...s,
        mrrCents:
          s.status === 'active' ? maps.priceCents[s.plan] ?? 0 : 0,
      })),
      total,
      page,
      limit,
    })
  } catch (e) {
    return adminErrorResponse(e)
  }
}
