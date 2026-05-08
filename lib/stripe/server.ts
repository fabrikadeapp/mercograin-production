import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[stripe] STRIPE_SECRET_KEY não configurada')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
  apiVersion: '2026-04-22.dahlia',
  typescript: true,
})

export type Plan = 'starter' | 'pro' | 'enterprise'

interface PlanConfig {
  name: string
  price: number // em centavos BRL
  productLookupKey: string
  priceLookupKey: string
}

export const PLANS: Record<Plan, PlanConfig> = {
  starter: {
    name: 'PHB Grain · Starter',
    price: 19700,
    productLookupKey: 'phbgrain_starter',
    priceLookupKey: 'phbgrain_starter_monthly',
  },
  pro: {
    name: 'PHB Grain · Pro',
    price: 49700,
    productLookupKey: 'phbgrain_pro',
    priceLookupKey: 'phbgrain_pro_monthly',
  },
  enterprise: {
    name: 'PHB Grain · Enterprise',
    price: 149700,
    productLookupKey: 'phbgrain_enterprise',
    priceLookupKey: 'phbgrain_enterprise_monthly',
  },
}

export const PLAN_LABELS: Record<Plan, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

const priceIdCache: Partial<Record<Plan, string>> = {}

/**
 * Garante que o produto e o price existem no Stripe (idempotente via lookup_key).
 * Retorna o priceId (Stripe id `price_...`).
 */
export async function ensurePrice(plan: Plan): Promise<string> {
  if (priceIdCache[plan]) return priceIdCache[plan]!

  const cfg = PLANS[plan]

  const existing = await stripe.prices.list({
    lookup_keys: [cfg.priceLookupKey],
    expand: ['data.product'],
    limit: 1,
  })

  if (existing.data[0]) {
    priceIdCache[plan] = existing.data[0].id
    return existing.data[0].id
  }

  let product: Stripe.Product
  const products = await stripe.products.list({ limit: 100 })
  const found = products.data.find(
    (p) => (p as any).metadata?.lookup_key === cfg.productLookupKey
  )
  if (found) {
    product = found
  } else {
    product = await stripe.products.create({
      name: cfg.name,
      metadata: { lookup_key: cfg.productLookupKey, plan },
    })
  }

  const price = await stripe.prices.create({
    unit_amount: cfg.price,
    currency: 'brl',
    recurring: { interval: 'month', interval_count: 1 },
    product: product.id,
    lookup_key: cfg.priceLookupKey,
    metadata: { plan },
  })

  priceIdCache[plan] = price.id
  return price.id
}

export function planFromPriceMetadata(price: Stripe.Price | null | undefined): Plan | null {
  const meta = price?.metadata?.plan
  if (meta === 'starter' || meta === 'pro' || meta === 'enterprise') return meta
  const lookup = price?.lookup_key
  if (lookup === 'phbgrain_starter_monthly') return 'starter'
  if (lookup === 'phbgrain_pro_monthly') return 'pro'
  if (lookup === 'phbgrain_enterprise_monthly') return 'enterprise'
  return null
}
