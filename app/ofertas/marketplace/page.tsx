import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { AppShell, PageHeader, Button } from '@/components/ui/phb'
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
        actions={
          <Link href="/ofertas/nova">
            <Button leftIcon={<Plus className="h-4 w-4" />}>
              Anunciar lote
            </Button>
          </Link>
        }
      />
      <MarketplaceList />
    </AppShell>
  )
}
