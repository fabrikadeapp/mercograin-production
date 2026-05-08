import { redirect, notFound } from 'next/navigation'
import { auth } from '@/auth'
import { loadPlanBySlug, loadActivePlans } from '@/lib/pricing/serialize'
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
  let slug = sp.plan

  // Fallback: pega o plano "highlight" ou primeiro ativo
  let plan = slug ? await loadPlanBySlug(slug) : null
  if (!plan || !plan.active) {
    const all = await loadActivePlans()
    plan = all.find((p) => p.highlight) ?? all[0] ?? null
  }
  if (!plan) return notFound()

  return (
    <div className="min-h-screen bg-bg-0 flex items-center justify-center p-6">
      <CheckoutClient
        plan={plan.slug}
        planLabel={plan.shortName}
        planName={plan.name}
        priceFormatted={plan.priceFormatted}
        canceled={sp.status === 'cancel'}
      />
    </div>
  )
}
