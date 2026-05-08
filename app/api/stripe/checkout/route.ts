import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { stripe, ensurePrice, type Plan } from '@/lib/stripe/server'

export const dynamic = 'force-dynamic'

async function ensureCustomer(userId: string, email: string, name: string): Promise<string> {
  const u = await db.user.findUnique({ where: { id: userId } })
  if (u?.stripeCustomerId) return u.stripeCustomerId
  const c = await stripe.customers.create({ email, name, metadata: { userId } })
  await db.user.update({ where: { id: userId }, data: { stripeCustomerId: c.id } })
  return c.id
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { plan?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const plan = body.plan as Plan | undefined
  if (!plan || !['starter', 'pro', 'enterprise'].includes(plan)) {
    return NextResponse.json({ error: 'invalid plan' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user) {
    return NextResponse.json({ error: 'user not found' }, { status: 404 })
  }

  try {
    const priceId = await ensurePrice(plan)
    const customerId = await ensureCustomer(user.id, user.email, user.nome)

    const origin =
      req.headers.get('origin') ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: 'always',
      subscription_data: {
        trial_period_days: 10,
        trial_settings: {
          end_behavior: { missing_payment_method: 'cancel' },
        },
        metadata: { userId: user.id, plan },
      },
      metadata: { userId: user.id, plan },
      success_url: `${origin}/assinatura?status=success&sid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/assinatura/checkout?plan=${plan}&status=cancel`,
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (err: any) {
    console.error('[stripe/checkout] error:', err)
    return NextResponse.json(
      { error: err?.message || 'stripe error' },
      { status: 500 }
    )
  }
}
