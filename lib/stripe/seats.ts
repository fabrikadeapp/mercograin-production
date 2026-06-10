import { stripe } from './server'
import { db } from '@/lib/db'

/**
 * Faixas de cobrança ESCALONADA POR VOLUME (graduated pricing) para
 * assentos extras (seats além do Plan.includedMembers).
 *
 * Graduado = cada faixa se aplica à PORÇÃO correspondente de seats, não o
 * preço de uma faixa para todos. Ex: 15 seats extras = 10×R$500 + 5×R$400.
 *
 * Regra de negócio aprovada pelo dono:
 *   - 1º ao 10º seat extra:  R$ 500,00/mês cada (50000 centavos)
 *   - 11º ao 30º seat extra: R$ 400,00/mês cada (40000 centavos)
 *   - 31º+ seat extra:       R$ 300,00/mês cada (30000 centavos)
 *
 * `up_to: null` representa o último tier (infinito) na criação do Price.
 * Valores em centavos (BRL). Configurável aqui no topo do arquivo — não
 * precisa expor no admin no momento.
 *
 * IMPORTANTE: ao alterar qualquer valor/limite abaixo, INCREMENTE
 * SEAT_TIERS_VERSION para forçar a recriação/invalidação do Price cacheado.
 */
const SEAT_TIERS: Array<{ up_to: number | null; unit_amount: number }> = [
  { up_to: 10, unit_amount: 50000 }, // 1º–10º
  { up_to: 30, unit_amount: 40000 }, // 11º–30º
  { up_to: null, unit_amount: 30000 }, // 31º+
]

/**
 * Versão da estrutura de tiers. Gravada em metadata.tiersVersion no Price.
 * Se a versão do Price cacheado divergir desta, o Price é arquivado e
 * recriado. Mais simples e robusto do que comparar arrays de tiers
 * (que exigiriam expand:['tiers'] no retrieve).
 */
const SEAT_TIERS_VERSION = 'v1-500-400-300'

/**
 * Garante existência de um Stripe Price recorrente TIERED (graduated) para
 * "membro extra". O preço NÃO é mais um unit_amount fixo — o Stripe aplica
 * automaticamente a graduação por faixa (SEAT_TIERS) sobre a quantity.
 *
 * Estratégia (Stripe não permite editar tiers de um Price existente):
 *   1. Se há priceId cacheado (Plan.stripeExtraSeatPriceId), valida que
 *      ainda é ativo, mensal, BRL, billing_scheme='tiered' e que
 *      metadata.tiersVersion === SEAT_TIERS_VERSION.
 *   2. Se válido, retorna ele.
 *   3. Se inválido (versão de tiers mudou, ou não é tiered, ou foi deletado),
 *      arquiva o antigo e cria novo Price tiered.
 *   4. Persiste o priceId em Plan.stripeExtraSeatPriceId (cache).
 *
 * Nota: Plan.extraMemberPriceCents ficou OBSOLETO para o cálculo de cobrança
 * (a graduação não usa um valor único). O campo é mantido no schema/DB pois
 * outros lugares podem lê-lo, mas NÃO é mais usado aqui como unit_amount.
 */
export async function ensureSeatPriceForPlan(planSlug: string): Promise<string> {
  const plan = await db.plan.findUnique({ where: { slug: planSlug } })
  if (!plan) throw new Error(`Plan ${planSlug} não encontrado`)

  const cachedPriceId = plan.stripeExtraSeatPriceId

  // Se já tem priceId cacheado, valida que ainda é um Price tiered válido e
  // na versão corrente de tiers (via metadata.tiersVersion).
  if (cachedPriceId) {
    try {
      const cached = await stripe.prices.retrieve(cachedPriceId)
      if (
        cached.active &&
        cached.billing_scheme === 'tiered' &&
        cached.tiers_mode === 'graduated' &&
        cached.recurring?.interval === 'month' &&
        cached.currency === 'brl' &&
        cached.metadata?.tiersVersion === SEAT_TIERS_VERSION
      ) {
        return cached.id
      }
      // Estrutura de tiers mudou ou price não está mais utilizável → arquiva
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
      name: `BH Grain · Membro Extra (${plan.name})`,
      metadata: {
        lookup_key: 'phbgrain_seat',
        planSlug,
        kind: 'seat',
      },
    })
  }

  // Cria Price novo TIERED (graduated). O Stripe cobra a quantity (extraSeats)
  // aplicando cada faixa à porção correspondente automaticamente.
  const newPrice = await stripe.prices.create({
    currency: 'brl',
    recurring: { interval: 'month' },
    product: product.id,
    billing_scheme: 'tiered',
    tiers_mode: 'graduated',
    tiers: SEAT_TIERS.map((t) => ({
      up_to: t.up_to === null ? ('inf' as const) : t.up_to,
      unit_amount: t.unit_amount,
    })),
    metadata: {
      kind: 'seat',
      planSlug,
      includedMembers: String(plan.includedMembers),
      tiersVersion: SEAT_TIERS_VERSION,
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
 * Usa o Price TIERED (graduated) garantido por ensureSeatPriceForPlan.
 *
 * Calcula extraSeats = max(0, memberCount - plan.includedMembers) e passa
 * esse valor como `quantity` do SubscriptionItem. NÃO calcula faixas
 * manualmente: com tiers graduated + quantity, o próprio Stripe aplica
 * cada faixa (SEAT_TIERS) à porção correspondente (ex: 15 extras =
 * 10×R$500 + 5×R$400). Atualiza/cria/remove o SubscriptionItem 'seat'.
 * Se a estrutura de tiers mudar (SEAT_TIERS_VERSION), o próximo sync cria
 * novo Price e move o item para ele, com proration no ciclo conforme
 * proration_behavior.
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
