import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { MarketplaceList } from '../_components/MarketplaceList'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  return (
    <AppShell>
      <PageHeader
        eyebrow="Mesa · Marketplace"
        title="Marketplace público"
        subtitle="Ofertas abertas e públicas de todas corretoras · leitura cross-tenant"
      />
      <MarketplaceList />
    </AppShell>
  )
}
