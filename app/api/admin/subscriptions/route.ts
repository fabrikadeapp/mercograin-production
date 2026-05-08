import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { PLANS } from '@/lib/stripe/server'
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
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { nome: { contains: q, mode: 'insensitive' } } },
      ]
    }

    const [subs, total] = await Promise.all([
      db.subscription.findMany({
        where,
        include: { user: { select: { id: true, nome: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.subscription.count({ where }),
    ])

    return NextResponse.json({
      data: subs.map((s) => ({
        ...s,
        mrrCents:
          s.status === 'active'
            ? PLANS[s.plan as keyof typeof PLANS]?.price ?? 0
            : 0,
      })),
      total,
      page,
      limit,
    })
  } catch (e) {
    return adminErrorResponse(e)
  }
}
