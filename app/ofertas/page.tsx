import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Globe2 } from 'lucide-react'
import { AppShell, PageHeader, Button } from '@/components/ui/phb'
import { OfertasHub } from './_components/OfertasHub'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  return (
    <AppShell>
      <PageHeader
        eyebrow="Mesa · S10 M2"
        title="Ofertas"
        subtitle="Propostas firmes de compra/venda · validade automática"
        actions={
          <>
            <Link href="/ofertas/marketplace">
              <Button variant="secondary" leftIcon={<Globe2 className="h-4 w-4" />}>
                Marketplace
              </Button>
            </Link>
            <Link href="/ofertas/nova">
              <Button leftIcon={<Plus className="h-4 w-4" />}>Nova oferta</Button>
            </Link>
          </>
        }
      />
      <OfertasHub />
    </AppShell>
  )
}
