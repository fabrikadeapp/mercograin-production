import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { PLANS } from '@/lib/stripe/server'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(req: Request) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? 'all'
    const plan = searchParams.get('plan') ?? 'all'
    const q = searchParams.get('q')?.trim() ?? ''

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

    const users = await db.user.findMany({
      where,
      include: { subscription: true },
      orderBy: { criadoEm: 'desc' },
    })

    const rows = [
      [
        'id',
        'nome',
        'email',
        'role',
        'criadoEm',
        'plan',
        'status',
        'mrr_cents',
        'trial_end',
        'current_period_end',
        'stripe_subscription_id',
      ],
      ...users.map((u) => [
        u.id,
        u.nome,
        u.email,
        u.role,
        u.criadoEm.toISOString(),
        u.subscription?.plan ?? '',
        u.subscription?.status ?? '',
        u.subscription?.status === 'active'
          ? PLANS[u.subscription.plan as keyof typeof PLANS]?.price ?? 0
          : 0,
        u.subscription?.trialEnd?.toISOString() ?? '',
        u.subscription?.currentPeriodEnd?.toISOString() ?? '',
        u.subscription?.stripeSubscriptionId ?? '',
      ]),
    ]

    const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n')
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (e) {
    return adminErrorResponse(e)
  }
}
