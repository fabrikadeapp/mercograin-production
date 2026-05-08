/**
 * Sincronização Plan ↔ Stripe.
 *
 * Stripe não permite editar `unit_amount` de um price, então quando o preço
 * muda criamos um price novo e arquivamos o anterior (movendo para
 * legacyPriceIds). Assinaturas em curso continuam no preço antigo (Stripe
 * respeita o price atrelado à subscription independente do `active`).
 */
import type { Plan } from '@prisma/client'
import { db } from '@/lib/db'
import { stripe } from '@/lib/stripe/server'

export interface SyncOptions {
  /** Se true, força criação de novo price mesmo sem mudança de valor (raramente útil). */
  forceNewPrice?: boolean
  /** Valor antigo (cents) para detectar mudança de preço. */
  previousPriceCents?: number | null
  /** Slug antigo (caso tenha mudado) — não usado por enquanto, slug é estável. */
  previousSlug?: string | null
  /** Se true, arquiva produto+price no Stripe (usado em DELETE/desativar). */
  archive?: boolean
}

interface SyncResult {
  productId: string | null
  priceId: string | null
  previousPriceArchived?: string | null
}

function intervalKey(plan: Plan): string {
  return plan.intervalCount > 1
    ? `${plan.billingInterval}_${plan.intervalCount}`
    : plan.billingInterval
}

function lookupKeyForPrice(plan: Plan): string {
  // Mantemos o padrão atual (`phbgrain_<slug>_<interval>`), mas adicionamos
  // o priceCents pra evitar colisão de lookup_key quando criamos novo price
  // após edição de valor (Stripe exige unicidade dentro de prices ATIVOS).
  return `phbgrain_${plan.slug}_${intervalKey(plan)}_${plan.priceCents}`
}

/**
 * Garante product + price no Stripe e atualiza o registro Plan no banco.
 * Idempotente: pode ser chamado após cada edição.
 */
export async function syncPlanWithStripe(
  planId: string,
  opts: SyncOptions = {}
): Promise<SyncResult> {
  const plan = await db.plan.findUnique({ where: { id: planId } })
  if (!plan) throw new Error(`Plan ${planId} não encontrado`)

  // ARCHIVE flow (DELETE / desativar)
  if (opts.archive) {
    let archivedPrice: string | null = null
    if (plan.stripePriceId) {
      try {
        await stripe.prices.update(plan.stripePriceId, { active: false })
        archivedPrice = plan.stripePriceId
      } catch (err: any) {
        console.warn('[pricing/sync] falha ao arquivar price:', err?.message)
      }
    }
    if (plan.stripeProductId) {
      try {
        await stripe.products.update(plan.stripeProductId, { active: false })
      } catch (err: any) {
        console.warn('[pricing/sync] falha ao arquivar product:', err?.message)
      }
    }
    return {
      productId: plan.stripeProductId,
      priceId: plan.stripePriceId,
      previousPriceArchived: archivedPrice,
    }
  }

  // 1) Garantir product
  let productId = plan.stripeProductId
  if (!productId) {
    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description || undefined,
      active: plan.active,
      metadata: {
        lookup_key: `phbgrain_${plan.slug}`,
        plan: plan.slug,
        planId: plan.id,
      },
    })
    productId = product.id
  } else {
    // Atualiza nome/descrição/active se mudaram
    try {
      await stripe.products.update(productId, {
        name: plan.name,
        description: plan.description || undefined,
        active: plan.active,
      })
    } catch (err: any) {
      console.warn('[pricing/sync] products.update falhou:', err?.message)
    }
  }

  // 2) Decidir se precisa criar novo price
  const priceChanged =
    opts.previousPriceCents != null &&
    opts.previousPriceCents !== plan.priceCents
  const noCurrentPrice = !plan.stripePriceId
  const needsNewPrice = priceChanged || noCurrentPrice || opts.forceNewPrice

  let priceId = plan.stripePriceId
  let previousPriceArchived: string | null = null

  if (needsNewPrice) {
    const price = await stripe.prices.create({
      unit_amount: plan.priceCents,
      currency: plan.currency.toLowerCase(),
      recurring: {
        interval: plan.billingInterval as 'day' | 'week' | 'month' | 'year',
        interval_count: plan.intervalCount,
      },
      product: productId,
      lookup_key: lookupKeyForPrice(plan),
      transfer_lookup_key: true,
      metadata: {
        plan: plan.slug,
        planId: plan.id,
      },
    })

    // Arquiva o anterior (se existia)
    if (plan.stripePriceId) {
      try {
        await stripe.prices.update(plan.stripePriceId, { active: false })
        previousPriceArchived = plan.stripePriceId
      } catch (err: any) {
        console.warn('[pricing/sync] falha ao arquivar price antigo:', err?.message)
      }
    }

    priceId = price.id
  }

  // 3) Persistir IDs e legacy
  await db.plan.update({
    where: { id: plan.id },
    data: {
      stripeProductId: productId,
      stripePriceId: priceId,
      legacyPriceIds:
        previousPriceArchived
          ? { set: [...plan.legacyPriceIds, previousPriceArchived] }
          : undefined,
    },
  })

  return { productId, priceId, previousPriceArchived }
}

/**
 * Bumpa a revision (singleton id=1) — chame após qualquer mutação no CMS.
 */
export async function bumpPricingRevision(): Promise<number> {
  const r = await db.pricingRevision.upsert({
    where: { id: 1 },
    create: { id: 1, revision: 1 },
    update: { revision: { increment: 1 } },
  })
  return r.revision
}
