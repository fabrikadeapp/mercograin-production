import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import type Stripe from 'stripe'
import { stripe, planFromPriceMetadata } from '@/lib/stripe/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function toDate(unix: number | null | undefined): Date | null {
  if (!unix) return null
  return new Date(unix * 1000)
}

async function upsertSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

  // Acha user pelo stripeCustomerId
  const user = await db.user.findUnique({ where: { stripeCustomerId: customerId } })
  if (!user) {
    console.warn('[stripe/webhook] user not found for customer', customerId)
    return
  }

  const item = sub.items.data[0]
  const price = item?.price
  const plan =
    planFromPriceMetadata(price) ||
    (sub.metadata?.plan as 'starter' | 'pro' | 'enterprise' | undefined) ||
    'pro'

  // Em versões recentes da API, current_period_start/end ficam no item.
  const periodStart = (item as any)?.current_period_start ?? (sub as any).current_period_start
  const periodEnd = (item as any)?.current_period_end ?? (sub as any).current_period_end

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
  }

  await db.subscription.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  })
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
        const user = await db.user.findUnique({
          where: { stripeCustomerId: customerId },
        })
        if (user) {
          await db.subscription.updateMany({
            where: { userId: user.id },
            data: { status: 'canceled', canceledAt: new Date() },
          })
        }
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
          const user = await db.user.findUnique({
            where: { stripeCustomerId: customerId },
          })
          if (user) {
            await db.subscription.updateMany({
              where: { userId: user.id },
              data: { status: 'past_due' },
            })
          }
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
