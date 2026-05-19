import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import type Stripe from 'stripe'
import { stripe, planFromPriceMetadata } from '@/lib/stripe/server'
import { db } from '@/lib/db'
import {
  gerarCodigoLicenca,
  gerarOnboardingToken,
  onboardingExpiresIn,
} from '@/lib/license/codigo'
import { sendEmail } from '@/lib/email/send'
import { licencaCompradaTemplate } from '@/lib/email/templates/licenca-comprada'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function toDate(unix: number | null | undefined): Date | null {
  if (!unix) return null
  return new Date(unix * 1000)
}

async function resolveWorkspaceForCustomer(customerId: string): Promise<string | null> {
  const user = await db.user.findUnique({ where: { stripeCustomerId: customerId } })
  if (!user) return null
  const ws = await db.workspace.findFirst({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'asc' },
  })
  return ws?.id ?? null
}

async function recountWorkspaceMembers(workspaceId: string) {
  const memberCount = await db.workspaceMember.count({
    where: { workspaceId, status: 'active' },
  })
  await db.subscription
    .update({
      where: { workspaceId },
      data: { memberCount },
    })
    .catch(() => undefined)
}

async function upsertSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

  const workspaceId = await resolveWorkspaceForCustomer(customerId)
  if (!workspaceId) {
    console.warn('[stripe/webhook] workspace not found for customer', customerId)
    return
  }

  const item = sub.items.data[0]
  const price = item?.price
  const plan =
    (await planFromPriceMetadata(price)) ||
    (sub.metadata?.plan as string | undefined) ||
    'pro'

  const periodStart = (item as any)?.current_period_start ?? (sub as any).current_period_start
  const periodEnd = (item as any)?.current_period_end ?? (sub as any).current_period_end

  // Detecta os items: base e seats (assentos extras)
  let stripeBaseItemId: string | null = null
  let stripeSeatsItemId: string | null = null
  for (const it of sub.items.data) {
    const meta = it.price?.metadata?.kind
    if (meta === 'seat' || it.price?.lookup_key === 'phbgrain_seat_extra_monthly') {
      stripeSeatsItemId = it.id
    } else {
      stripeBaseItemId ||= it.id
    }
  }

  const data = {
    stripeSubscriptionId: sub.id,
    stripeCustomerId: customerId,
    stripePriceId: price?.id || '',
    plan,
    status: sub.status,
    trialStart: toDate(sub.trial_start),
    trialEnd: toDate(sub.trial_end),
    currentPeriodStart: toDate(periodStart),
    currentPeriodEnd: toDate(periodEnd),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: toDate(sub.canceled_at),
    stripeBaseItemId,
    stripeSeatsItemId,
  }

  await db.subscription.upsert({
    where: { workspaceId },
    create: { workspaceId, ...data },
    update: data,
  })

  await recountWorkspaceMembers(workspaceId)
}

/**
 * Purchase-first: cria License em status=pending após pagamento.
 * NÃO cria User/Workspace — isso só acontece quando o cliente clicar no
 * link mágico e completar o onboarding em /ativar/[token].
 *
 * Idempotente: se já existe License para este stripeSubscriptionId, faz
 * no-op (Stripe pode reentregar webhooks).
 */
async function handlePurchaseFirstSession(session: Stripe.Checkout.Session) {
  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id
  if (!customerId) {
    console.warn('[stripe/webhook] purchase-first sem customer')
    return
  }

  const subId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id

  // Idempotência — se já criamos a license para essa subscription, sai.
  if (subId) {
    const existing = await db.license.findUnique({
      where: { stripeSubscriptionId: subId },
    })
    if (existing) {
      console.log('[stripe/webhook] license já existe', existing.codigo)
      return
    }
  }

  const meta = session.metadata || {}
  const email =
    (meta.email as string | undefined) ||
    session.customer_email ||
    session.customer_details?.email ||
    ''
  if (!email) {
    console.error('[stripe/webhook] purchase-first sem email')
    return
  }
  const plano = (meta.plan as string | undefined) || 'pro'
  const nomeComprador =
    (meta.nome as string | undefined) ||
    session.customer_details?.name ||
    null

  // Gera código único — colisão é improvável (32^6 ≈ 1 bilhão), mas
  // retry algumas vezes só pra garantir.
  let codigo = gerarCodigoLicenca()
  for (let i = 0; i < 5; i++) {
    const dup = await db.license.findUnique({ where: { codigo } })
    if (!dup) break
    codigo = gerarCodigoLicenca()
  }

  const onboardingToken = gerarOnboardingToken()
  const onboardingExpiresAt = onboardingExpiresIn(7)

  const license = await db.license.create({
    data: {
      codigo,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subId || null,
      email,
      nomeComprador,
      plano,
      status: 'pending',
      onboardingToken,
      onboardingExpiresAt,
      metadataJson: {
        cnpj: (meta.cnpj as string | undefined) || null,
        sessionId: session.id,
      },
    },
  })

  // Audit: license criada pelo webhook. Como ainda não há User no sistema,
  // registramos com userId sentinel "system:stripe-webhook" (campo é String livre).
  logAudit({
    userId: 'system:stripe-webhook',
    acao: 'license_create',
    entidade: 'license',
    entidadeId: license.id,
    mudancas: {
      codigo,
      plano,
      email,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subId || null,
    },
  }).catch(() => undefined)

  // Resolve nome amigável do plano (cai para slug em uppercase).
  const planRow = await db.plan.findUnique({ where: { slug: plano } })
  const planoNome = planRow?.name || plano.toUpperCase()

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'https://www.profitsync.ia.br'
  const ativarUrl = `${appUrl}/ativar/${onboardingToken}`

  const tpl = licencaCompradaTemplate({
    nome: nomeComprador || email,
    email,
    codigoLicenca: codigo,
    planoNome,
    ativarUrl,
    validadeDias: 7,
  })

  await sendEmail({
    to: email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    tags: [
      { name: 'kind', value: 'licenca-comprada' },
      { name: 'codigo', value: codigo },
    ],
  })

  console.log('[stripe/webhook] license criada', license.codigo, 'para', email)
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig = (await headers()).get('stripe-signature') || ''
  const secret = process.env.STRIPE_WEBHOOK_SECRET || ''

  if (!secret) {
    console.warn('[stripe/webhook] STRIPE_WEBHOOK_SECRET vazio — rejeitando evento')
    return NextResponse.json(
      { error: 'webhook secret not configured' },
      { status: 500 }
    )
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch (e: any) {
    console.error('[stripe/webhook] signature invalid:', e.message)
    return NextResponse.json(
      { error: `webhook signature invalid: ${e.message}` },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        // Purchase-first: source=purchase-first nos metadata indica que
        // não existe User/Workspace ainda. Criamos License em status=pending.
        if (session.metadata?.source === 'purchase-first') {
          await handlePurchaseFirstSession(session)
        }
        if (session.mode === 'subscription' && session.subscription) {
          const subId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id
          const sub = await stripe.subscriptions.retrieve(subId)
          await upsertSubscription(sub)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        await upsertSubscription(sub)
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId =
          typeof sub.customer === 'string' ? sub.customer : sub.customer.id
        await db.subscription.updateMany({
          where: { stripeCustomerId: customerId },
          data: { status: 'canceled', canceledAt: new Date() },
        })
        break
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const subRef =
          (invoice as any).subscription ||
          (invoice as any).parent?.subscription_details?.subscription ||
          invoice.lines?.data?.[0]?.subscription
        if (subRef) {
          const subId = typeof subRef === 'string' ? subRef : subRef.id
          const sub = await stripe.subscriptions.retrieve(subId)
          await upsertSubscription(sub)
        }
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId =
          typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id
        if (customerId) {
          await db.subscription.updateMany({
            where: { stripeCustomerId: customerId },
            data: { status: 'past_due' },
          })
        }
        break
      }
      default:
        // ignored
        break
    }
  } catch (err: any) {
    console.error('[stripe/webhook] handler error:', err)
    return NextResponse.json({ error: err?.message || 'handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
