import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { PLANS, PLAN_LABELS } from '@/lib/stripe/server'
import { AssinaturaClient } from './AssinaturaClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ status?: string; sid?: string }>
}

export default async function AssinaturaPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/auth/login')
  }

  const sp = await searchParams
  const sub = await db.subscription.findUnique({
    where: { userId: session.user.id },
  })

  const plan = (sub?.plan as 'starter' | 'pro' | 'enterprise' | undefined) || null
  const planCfg = plan ? PLANS[plan] : null
  const priceFormatted = planCfg
    ? (planCfg.price / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
    : null

  return (
    <AssinaturaClient
      success={sp.status === 'success'}
      subscription={
        sub
          ? {
              plan: sub.plan,
              planLabel: plan ? PLAN_LABELS[plan] : sub.plan,
              priceFormatted: priceFormatted || '—',
              status: sub.status,
              trialEnd: sub.trialEnd?.toISOString() || null,
              currentPeriodEnd: sub.currentPeriodEnd?.toISOString() || null,
              cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            }
          : null
      }
    />
  )
}
