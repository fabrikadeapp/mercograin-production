import { stripe } from './server'
import { db } from '@/lib/db'

/**
 * Garante existência de um Stripe Price recorrente para "membro extra"
 * com o valor configurado no Plan (DB). NÃO usa hardcode — preço vem
 * do banco e é editável via /admin/pricing.
 *
 * Estratégia (Stripe não permite editar preço de Price existente):
 *   1. Procura Price ativo com metadata.kind='seat' + metadata.planSlug={slug} +
 *      unit_amount === plan.extraMemberPriceCents
 *   2. Se encontra, retorna ele
 *   3. Se NÃO encontra (preço mudou ou primeira vez), arquiva o antigo e cria novo
 *   4. Persiste o priceId em Plan.stripeExtraSeatPriceId pra cache
 *
 * Resultado: SuperAdmin altera extraMemberPriceCents em /admin/pricing,
 * próxima chamada syncWorkspaceSeats cria novo Price e usa ele. Subscriptions
 * existentes mantêm preço antigo até proximo billing cycle ou novo update.
 */
export async function ensureSeatPriceForPlan(planSlug: string): Promise<string> {
  const plan = await db.plan.findUnique({ where: { slug: planSlug } })
  if (!plan) throw new Error(`Plan ${planSlug} não encontrado`)

  const desiredAmount = plan.extraMemberPriceCents
  const cachedPriceId = plan.stripeExtraSeatPriceId

  // Se já tem priceId cacheado, valida que ainda é válido e tem valor correto
  if (cachedPriceId) {
    try {
      const cached = await stripe.prices.retrieve(cachedPriceId)
      if (
        cached.active &&
        cached.unit_amount === desiredAmount &&
        cached.recurring?.interval === 'month' &&
        cached.currency === 'brl'
      ) {
        return cached.id
      }
      // Valor mudou ou price não está mais utilizável → arquiva
      if (cached.active) {
        await stripe.prices.update(cachedPriceId, { active: false }).catch(() => {})
      }
    } catch {
      // Price inexistente no Stripe (pode ter sido deletado) — ignora e cria novo
    }
  }

  // Cria/recupera produto seat
  let product
  const existingProducts = await stripe.products.list({ limit: 100 })
  const found = existingProducts.data.find(
    (p) =>
      p.metadata?.lookup_key === 'phbgrain_seat' &&
      p.metadata?.planSlug === planSlug
  )
  if (found) {
    product = found
  } else {
    product = await stripe.products.create({
      name: `PHB Grain · Membro Extra (${plan.name})`,
      metadata: {
        lookup_key: 'phbgrain_seat',
        planSlug,
        kind: 'seat',
      },
    })
  }

  // Cria Price novo com valor atual do plano
  const newPrice = await stripe.prices.create({
    unit_amount: desiredAmount,
    currency: 'brl',
    recurring: { interval: 'month' },
    product: product.id,
    metadata: {
      kind: 'seat',
      planSlug,
      includedMembers: String(plan.includedMembers),
    },
  })

  // Persiste no plano
  await db.plan.update({
    where: { id: plan.id },
    data: { stripeExtraSeatPriceId: newPrice.id },
  })

  return newPrice.id
}

/**
 * Sincroniza assentos extras na Subscription do workspace com o Stripe.
 * Usa o preço configurado no Plan (banco) — NÃO hardcoded.
 *
 * Calcula extraSeats = max(0, memberCount - plan.includedMembers).
 * Atualiza/cria/remove Stripe SubscriptionItem do tipo 'seat'.
 * Quando preço do plano muda em /admin/pricing, próximo sync cria novo
 * Price e move o item para ele (subscriptions existentes pagam o novo
 * valor no próximo ciclo, conforme proration_behavior).
 */
export async function syncWorkspaceSeats(workspaceId: string): Promise<{
  memberCount: number
  includedMembers: number
  extraSeats: number
  stripeSeatsItemId: string | null
}> {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      subscription: true,
      members: { where: { status: 'active' } },
    },
  })
  if (!ws) throw new Error(`Workspace ${workspaceId} não encontrado`)

  const memberCount = ws.members.length
  const sub = ws.subscription

  const plan = sub?.plan
    ? await db.plan.findUnique({ where: { slug: sub.plan } })
    : null
  const includedMembers = plan?.includedMembers ?? 1
  const extraSeats = Math.max(0, memberCount - includedMembers)

  if (!sub) {
    return { memberCount, includedMembers, extraSeats, stripeSeatsItemId: null }
  }

  let seatsItemId = sub.stripeSeatsItemId

  const isTerminal = ['canceled', 'incomplete_expired', 'unpaid'].includes(sub.status)

  if (!isTerminal) {
    try {
      if (extraSeats === 0) {
        if (seatsItemId) {
          await stripe.subscriptionItems.del(seatsItemId, {
            proration_behavior: 'create_prorations',
          })
          seatsItemId = null
        }
      } else {
        // Pega/cria Price com valor ATUAL do plano (sempre que muda preço, cria novo)
        const seatPriceId = await ensureSeatPriceForPlan(sub.plan)

        if (seatsItemId) {
          // Confere se o item atual usa o priceId correto
          const currentItem = await stripe.subscriptionItems
            .retrieve(seatsItemId)
            .catch(() => null)

          if (currentItem && currentItem.price.id !== seatPriceId) {
            // Preço mudou — substitui price do item
            await stripe.subscriptionItems.update(seatsItemId, {
              price: seatPriceId,
              quantity: extraSeats,
              proration_behavior: 'create_prorations',
            })
          } else {
            // Mesmo price, só atualiza quantity
            await stripe.subscriptionItems.update(seatsItemId, {
              quantity: extraSeats,
              proration_behavior: 'create_prorations',
            })
          }
        } else {
          const item = await stripe.subscriptionItems.create({
            subscription: sub.stripeSubscriptionId,
            price: seatPriceId,
            quantity: extraSeats,
            proration_behavior: 'create_prorations',
          })
          seatsItemId = item.id
        }
      }
    } catch (err) {
      console.error('[seats.sync] stripe error:', err)
      // continua para atualizar contador local
    }
  }

  await db.subscription.update({
    where: { id: sub.id },
    data: {
      memberCount,
      extraSeatsCount: extraSeats,
      stripeSeatsItemId: seatsItemId,
    },
  })

  return { memberCount, includedMembers, extraSeats, stripeSeatsItemId: seatsItemId }
}

// Backward compat: mantém export antigo apontando pra função genérica
export async function ensureSeatPrice(): Promise<string> {
  // Default usa plano Pro como referência (mesma lógica de antes)
  return ensureSeatPriceForPlan('pro')
}
