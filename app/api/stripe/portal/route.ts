import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { stripe } from '@/lib/stripe/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user?.stripeCustomerId) {
    return NextResponse.json(
      { error: 'sem customer stripe' },
      { status: 400 }
    )
  }

  const origin =
    req.headers.get('origin') ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${origin}/assinatura`,
    })
    return NextResponse.json({ url: portal.url })
  } catch (err: any) {
    console.error('[stripe/portal] error:', err)
    return NextResponse.json(
      { error: err?.message || 'stripe portal error' },
      { status: 500 }
    )
  }
}
