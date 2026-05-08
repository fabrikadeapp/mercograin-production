/**
 * GET /api/admin/pricing/plans  — lista todos (incluindo inativos)
 * POST /api/admin/pricing/plans — cria plano novo + sincroniza Stripe
 */
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'
import { loadAllPlans, serializePlan } from '@/lib/pricing/serialize'
import { syncPlanWithStripe, bumpPricingRevision } from '@/lib/pricing/sync'

export const dynamic = 'force-dynamic'

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/

const createSchema = z.object({
  slug: z.string().regex(SLUG_RE, 'slug inválido (use a-z 0-9 -)'),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  tagline: z.string().optional().nullable(),
  badge: z.string().optional().nullable(),
  highlight: z.boolean().optional().default(false),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().default('BRL'),
  billingInterval: z.enum(['day', 'week', 'month', 'year']).default('month'),
  intervalCount: z.number().int().positive().default(1),
  trialDays: z.number().int().nonnegative().default(10),
  ctaLabel: z.string().default('Iniciar trial'),
  ctaHref: z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
})

export async function GET() {
  try {
    await requireAdmin()
    const plans = await loadAllPlans()
    return NextResponse.json({ plans })
  } catch (err) {
    return adminErrorResponse(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const data = createSchema.parse(body)

    // Garante slug único
    const existing = await db.plan.findUnique({ where: { slug: data.slug } })
    if (existing) {
      return NextResponse.json(
        { error: 'slug_already_exists' },
        { status: 409 }
      )
    }

    const plan = await db.plan.create({
      data: {
        slug: data.slug,
        name: data.name,
        description: data.description ?? null,
        tagline: data.tagline ?? null,
        badge: data.badge ?? null,
        highlight: data.highlight ?? false,
        priceCents: data.priceCents,
        currency: data.currency,
        billingInterval: data.billingInterval,
        intervalCount: data.intervalCount,
        trialDays: data.trialDays,
        ctaLabel: data.ctaLabel,
        ctaHref: data.ctaHref ?? null,
        sortOrder: data.sortOrder,
        active: data.active,
      },
      include: { features: true },
    })

    // Sincroniza Stripe (best-effort: se falhar, ainda devolvemos o plano)
    let stripeError: string | null = null
    try {
      await syncPlanWithStripe(plan.id)
    } catch (err: any) {
      console.error('[plans/POST] sync stripe falhou:', err)
      stripeError = err?.message || 'stripe_sync_failed'
    }

    await bumpPricingRevision()
    revalidatePath('/')
    revalidatePath('/precos')

    const fresh = await db.plan.findUnique({
      where: { id: plan.id },
      include: { features: true },
    })

    return NextResponse.json(
      {
        plan: fresh ? serializePlan(fresh) : null,
        stripeError,
      },
      { status: 201 }
    )
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
