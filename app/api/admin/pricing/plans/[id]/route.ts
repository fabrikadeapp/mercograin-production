/**
 * GET    /api/admin/pricing/plans/[id]  — detalhe + count assinantes
 * PUT    /api/admin/pricing/plans/[id]  — edita; cria novo price se valor mudou
 * DELETE /api/admin/pricing/plans/[id]  — soft delete (active=false) + arquiva no Stripe
 */
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'
import { serializePlan } from '@/lib/pricing/serialize'
import { syncPlanWithStripe, bumpPricingRevision } from '@/lib/pricing/sync'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  tagline: z.string().nullable().optional(),
  badge: z.string().nullable().optional(),
  highlight: z.boolean().optional(),
  priceCents: z.number().int().nonnegative().optional(),
  currency: z.string().optional(),
  billingInterval: z.enum(['day', 'week', 'month', 'year']).optional(),
  intervalCount: z.number().int().positive().optional(),
  trialDays: z.number().int().nonnegative().optional(),
  ctaLabel: z.string().optional(),
  ctaHref: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()
    const plan = await db.plan.findUnique({
      where: { id: params.id },
      include: { features: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!plan) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    // Conta subscriptions ativas com este stripePriceId (atual ou legacy)
    const priceIds = [plan.stripePriceId, ...plan.legacyPriceIds].filter(
      (x): x is string => !!x
    )
    let subscribersCount = 0
    let subscribers: Array<{
      id: string
      status: string
      userEmail: string
      createdAt: Date
    }> = []
    if (priceIds.length > 0) {
      subscribersCount = await db.subscription.count({
        where: {
          stripePriceId: { in: priceIds },
          status: { in: ['trialing', 'active', 'past_due'] },
        },
      })
      const rows = await db.subscription.findMany({
        where: { stripePriceId: { in: priceIds } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { email: true } } },
      })
      subscribers = rows.map((r) => ({
        id: r.id,
        status: r.status,
        userEmail: r.user?.email ?? '—',
        createdAt: r.createdAt,
      }))
    }

    return NextResponse.json({
      plan: serializePlan(plan),
      subscribersCount,
      subscribers,
    })
  } catch (err) {
    return adminErrorResponse(err)
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()
    const body = await req.json()
    const data = updateSchema.parse(body)

    const before = await db.plan.findUnique({ where: { id: params.id } })
    if (!before) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    const updated = await db.plan.update({
      where: { id: params.id },
      data: {
        ...data,
      },
      include: { features: true },
    })

    let stripeError: string | null = null
    try {
      await syncPlanWithStripe(updated.id, {
        previousPriceCents: before.priceCents,
      })
    } catch (err: any) {
      console.error('[plans/PUT] sync stripe falhou:', err)
      stripeError = err?.message || 'stripe_sync_failed'
    }

    await bumpPricingRevision()
    revalidatePath('/')
    revalidatePath('/precos')

    const fresh = await db.plan.findUnique({
      where: { id: updated.id },
      include: { features: { orderBy: { sortOrder: 'asc' } } },
    })

    return NextResponse.json({
      plan: fresh ? serializePlan(fresh) : null,
      stripeError,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'validation', details: err.flatten() },
        { status: 400 }
      )
    }
    return adminErrorResponse(err)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()
    const existing = await db.plan.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    // Soft delete (preserva subscriptions vinculadas)
    await db.plan.update({
      where: { id: params.id },
      data: { active: false },
    })

    let stripeError: string | null = null
    try {
      await syncPlanWithStripe(params.id, { archive: true })
    } catch (err: any) {
      console.error('[plans/DELETE] arquivar stripe falhou:', err)
      stripeError = err?.message || 'stripe_archive_failed'
    }

    await bumpPricingRevision()
    revalidatePath('/')
    revalidatePath('/precos')

    return NextResponse.json({ ok: true, stripeError })
  } catch (err) {
    return adminErrorResponse(err)
  }
}
