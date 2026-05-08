/**
 * Serialização de Plan + features para a API pública e consumidores
 * server-side (Pricing.tsx, /precos, /assinatura/checkout).
 */
import type { Plan, PlanFeature } from '@prisma/client'
import { db } from '@/lib/db'
import { formatBRL, formatBRLShort, formatIntervalLabel } from './format'

export interface SerializedFeature {
  id: string
  label: string
  included: boolean
  emphasis: boolean
  sortOrder: number
}

export interface SerializedPlan {
  id: string
  slug: string
  name: string
  shortName: string
  tagline: string | null
  description: string | null
  badge: string | null
  highlight: boolean
  priceCents: number
  priceFormatted: string
  priceFormattedShort: string
  currency: string
  billingInterval: string
  intervalCount: number
  intervalLabel: string
  trialDays: number
  ctaLabel: string
  ctaHref: string
  active: boolean
  sortOrder: number
  stripeProductId: string | null
  stripePriceId: string | null
  legacyPriceIds: string[]
  features: SerializedFeature[]
  includedFeatures: SerializedFeature[]
}

function toShortName(name: string): string {
  // 'PHB Grain · Starter' → 'Starter'
  const idx = name.lastIndexOf('·')
  if (idx >= 0) return name.slice(idx + 1).trim()
  return name
}

export function serializePlan(
  plan: Plan & { features?: PlanFeature[] }
): SerializedPlan {
  const features = (plan.features ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((f) => ({
      id: f.id,
      label: f.label,
      included: f.included,
      emphasis: f.emphasis,
      sortOrder: f.sortOrder,
    }))

  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    shortName: toShortName(plan.name),
    tagline: plan.tagline,
    description: plan.description,
    badge: plan.badge,
    highlight: plan.highlight,
    priceCents: plan.priceCents,
    priceFormatted: formatBRL(plan.priceCents, plan.currency),
    priceFormattedShort: formatBRLShort(plan.priceCents),
    currency: plan.currency,
    billingInterval: plan.billingInterval,
    intervalCount: plan.intervalCount,
    intervalLabel: formatIntervalLabel(plan.billingInterval, plan.intervalCount),
    trialDays: plan.trialDays,
    ctaLabel: plan.ctaLabel,
    ctaHref: plan.ctaHref || `/auth/signup?plan=${plan.slug}`,
    active: plan.active,
    sortOrder: plan.sortOrder,
    stripeProductId: plan.stripeProductId,
    stripePriceId: plan.stripePriceId,
    legacyPriceIds: plan.legacyPriceIds,
    features,
    includedFeatures: features.filter((f) => f.included),
  }
}

export async function loadActivePlans(): Promise<SerializedPlan[]> {
  const plans = await db.plan.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    include: { features: { orderBy: { sortOrder: 'asc' } } },
  })
  return plans.map(serializePlan)
}

export async function loadAllPlans(): Promise<SerializedPlan[]> {
  const plans = await db.plan.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { features: { orderBy: { sortOrder: 'asc' } } },
  })
  return plans.map(serializePlan)
}

export async function loadPlanBySlug(slug: string): Promise<SerializedPlan | null> {
  const plan = await db.plan.findUnique({
    where: { slug },
    include: { features: { orderBy: { sortOrder: 'asc' } } },
  })
  return plan ? serializePlan(plan) : null
}
