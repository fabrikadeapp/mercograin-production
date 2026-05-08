import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { PLANS, PLAN_LABELS, type Plan } from '@/lib/stripe/server'
import { CheckoutClient } from './CheckoutClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ plan?: string; status?: string }>
}

export default async function CheckoutPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/auth/login')
  }

  const sp = await searchParams
  const planParam = sp.plan
  const plan: Plan =
    planParam === 'starter' || planParam === 'pro' || planParam === 'enterprise'
      ? planParam
      : 'pro'

  const cfg = PLANS[plan]
  const priceFormatted = (cfg.price / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

  return (
    <div className="min-h-screen bg-bg-0 flex items-center justify-center p-6">
      <CheckoutClient
        plan={plan}
        planLabel={PLAN_LABELS[plan]}
        planName={cfg.name}
        priceFormatted={priceFormatted}
        canceled={sp.status === 'cancel'}
      />
    </div>
  )
}
