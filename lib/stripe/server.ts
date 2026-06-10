import Stripe from 'stripe'
import { db } from '@/lib/db'

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[stripe] STRIPE_SECRET_KEY não configurada')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
  apiVersion: '2026-04-22.dahlia',
  typescript: true,
})

/**
 * Garante que a Stripe está configurada com uma chave real ANTES de
 * executar qualquer cobrança/checkout/webhook.
 *
 * NÃO valida no top-level do módulo de propósito: o `next build` carrega
 * este módulo e pode rodar com NODE_ENV=production sem a env — um throw
 * no load quebraria o build. Validamos de forma LAZY (por request),
 * chamando `assertStripeConfigured()` no início de cada handler.
 *
 * Em dev/test mantemos o fallback dummy para não travar o build local.
 */
export class StripeNotConfiguredError extends Error {
  constructor() {
    super('STRIPE_SECRET_KEY ausente/inválida em produção')
    this.name = 'StripeNotConfiguredError'
  }
}

export function assertStripeConfigured(): void {
  if (process.env.NODE_ENV !== 'production') return
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || !key.startsWith('sk_')) {
    throw new StripeNotConfiguredError()
  }
}

/**
 * @deprecated O conjunto de planos não é mais fixo — leia do model Plan.
 * Mantido como string genérica para compatibilidade com Subscription.plan.
 */
export type Plan = string

/**
 * Resolve o priceId Stripe ATIVO de um plano pelo slug (lendo do CMS).
 * Substitui o antigo `ensurePrice()` — agora os planos vivem no banco.
 */
export async function getPriceIdForPlan(slug: string): Promise<string> {
  const plan = await db.plan.findUnique({ where: { slug } })
  if (!plan) throw new Error(`plano "${slug}" não encontrado`)
  if (!plan.active) throw new Error(`plano "${slug}" está inativo`)
  if (!plan.stripePriceId) {
    throw new Error(
      `plano "${slug}" sem stripePriceId — sincronize via /admin/pricing`
    )
  }
  return plan.stripePriceId
}

/**
 * @deprecated Use `getPriceIdForPlan(slug)`. Mantido por compatibilidade
 * com chamadas legadas; encaminha para o novo helper.
 */
export async function ensurePrice(slug: string): Promise<string> {
  return getPriceIdForPlan(slug)
}

/**
 * Resolve o slug do plano a partir de um Stripe.Price (current ou legacy).
 * Usa metadata.plan; cai pra match em legacyPriceIds/stripePriceId no banco.
 */
export async function planFromPriceMetadata(
  price: Stripe.Price | null | undefined
): Promise<string | null> {
  if (!price) return null
  const meta = price?.metadata?.plan
  if (meta) return meta

  const found = await db.plan.findFirst({
    where: {
      OR: [
        { stripePriceId: price.id },
        { legacyPriceIds: { has: price.id } },
      ],
    },
    select: { slug: true },
  })
  return found?.slug ?? null
}

/**
 * Helper sync para webhooks que não querem fazer query async (raríssimo).
 * Tenta apenas via metadata; se ausente, devolve null.
 */
export function planFromPriceMetadataSync(
  price: Stripe.Price | null | undefined
): string | null {
  return price?.metadata?.plan || null
}
