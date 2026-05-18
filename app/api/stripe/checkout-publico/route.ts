/**
 * Checkout público (purchase-first) — não exige sessão.
 *
 * Recebe { plan, email, nome, cnpj? }, valida plano contra Plan CMS, cria
 * Stripe Checkout Session pré-preenchida com o e-mail. O webhook
 * `checkout.session.completed` é quem cria a License (ver
 * `app/api/stripe/webhook/route.ts`).
 *
 * NÃO cria User nem Workspace aqui — esses só nascem quando o cliente
 * clicar no link mágico em /ativar/[token].
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stripe, getPriceIdForPlan } from '@/lib/stripe/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function isEmailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: NextRequest) {
  let body: { plan?: string; email?: string; nome?: string; cnpj?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const plan = (body.plan || '').trim()
  const email = (body.email || '').trim().toLowerCase()
  const nome = (body.nome || '').trim() || null
  const cnpj = (body.cnpj || '').trim() || null

  if (!plan) {
    return NextResponse.json({ error: 'Plano obrigatório' }, { status: 400 })
  }
  if (!email || !isEmailValido(email)) {
    return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 })
  }

  const planRow = await db.plan.findUnique({ where: { slug: plan } })
  if (!planRow || !planRow.active) {
    return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
  }

  // Heurística: se já existe um User com esse e-mail, sugerimos login no
  // fluxo signup-first. (Mantemos a porta aberta para purchase-first criar
  // múltiplas licenças do mesmo e-mail no futuro — por ora, bloqueia.)
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      {
        error:
          'Já existe uma conta com este e-mail. Faça login e contrate em /assinatura.',
        loginUrl: '/auth/login',
      },
      { status: 409 }
    )
  }

  try {
    const priceId = await getPriceIdForPlan(plan)
    const origin =
      req.headers.get('origin') ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: 'always',
      subscription_data: {
        trial_period_days: planRow.trialDays,
        trial_settings: {
          end_behavior: { missing_payment_method: 'cancel' },
        },
        metadata: {
          plan,
          email,
          nome: nome || '',
          cnpj: cnpj || '',
          source: 'purchase-first',
        },
      },
      metadata: {
        plan,
        email,
        nome: nome || '',
        cnpj: cnpj || '',
        source: 'purchase-first',
      },
      success_url: `${origin}/comprar/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/comprar?plan=${plan}&status=cancel`,
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (err: any) {
    console.error('[stripe/checkout-publico] error:', err)
    return NextResponse.json(
      { error: err?.message || 'Erro ao iniciar checkout' },
      { status: 500 }
    )
  }
}
