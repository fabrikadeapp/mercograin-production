import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { loadPlanBySlug } from '@/lib/pricing/serialize'
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

  const planRow = sub?.plan ? await loadPlanBySlug(sub.plan) : null

  return (
    <AssinaturaClient
      success={sp.status === 'success'}
      subscription={
        sub
          ? {
              plan: sub.plan,
              planLabel: planRow?.shortName ?? sub.plan,
              priceFormatted: planRow?.priceFormatted ?? '—',
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
