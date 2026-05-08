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

    const where: Prisma.UserWhereInput = {}
    if (q) {
      where.OR = [
        { nome: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (status === 'none') where.subscription = null
    else if (status !== 'all') where.subscription = { status }
    if (plan !== 'all') {
      where.subscription = { ...(where.subscription as object), plan }
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        include: { subscription: true },
        orderBy: { criadoEm: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
    ])

    const data = users.map((u) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      role: u.role,
      criadoEm: u.criadoEm,
      subscription: u.subscription
        ? {
            plan: u.subscription.plan,
            status: u.subscription.status,
            trialEnd: u.subscription.trialEnd,
            currentPeriodEnd: u.subscription.currentPeriodEnd,
            mrrCents:
              u.subscription.status === 'active'
                ? PLANS[u.subscription.plan as keyof typeof PLANS]?.price ?? 0
                : 0,
          }
        : null,
    }))

    return NextResponse.json({ data, total, page, limit })
  } catch (e) {
    return adminErrorResponse(e)
  }
}
