import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Globe2 } from 'lucide-react'
import { VgAppShell, VgPageHeader } from '@/components/ui/visionglass'
import { OfertasHub } from '../ofertas/_components/OfertasHub'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <VgAppShell>
      <VgPageHeader
        eyebrow="Mesa · Originação"
        title="Ofertas"
        subtitle="Propostas firmes de compra/venda · validade automática"
        actions={
          <>
            <Link href="/ofertas/marketplace" className="vg-btn vg-btn--secondary">
              <Globe2 className="w-4 h-4" /> Marketplace
            </Link>
            <Link href="/ofertas/nova" className="vg-btn vg-btn--primary">
              <Plus className="w-4 h-4" /> Nova oferta
            </Link>
          </>
        }
      />
      <OfertasHub />
    </VgAppShell>
  )
}
