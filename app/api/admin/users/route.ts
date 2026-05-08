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

    const where: Prisma.UserWhereInput = {}
    if (q) {
      where.OR = [
        { nome: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ]
    }
    const subFilter: any = {}
    if (status !== 'all' && status !== 'none') subFilter.status = status
    if (plan !== 'all') subFilter.plan = plan
    if (status === 'none') {
      where.workspacesOwned = { every: { subscription: null } }
    } else if (Object.keys(subFilter).length) {
      where.workspacesOwned = { some: { subscription: subFilter } }
    }

    const [users, total, maps] = await Promise.all([
      db.user.findMany({
        where,
        include: {
          workspacesOwned: {
            orderBy: { createdAt: 'asc' },
            take: 1,
            include: { subscription: true },
          },
        },
        orderBy: { criadoEm: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
      loadPlanMaps(),
    ])

    const data = users.map((u) => {
      const sub = u.workspacesOwned[0]?.subscription ?? null
      return {
        id: u.id,
        nome: u.nome,
        email: u.email,
        role: u.role,
        criadoEm: u.criadoEm,
        subscription: sub
          ? {
              plan: sub.plan,
              status: sub.status,
              trialEnd: sub.trialEnd,
              currentPeriodEnd: sub.currentPeriodEnd,
              mrrCents:
                sub.status === 'active'
                  ? maps.priceCents[sub.plan] ?? 0
                  : 0,
            }
          : null,
      }
    })

    return NextResponse.json({ data, total, page, limit })
  } catch (e) {
    return adminErrorResponse(e)
  }
}
