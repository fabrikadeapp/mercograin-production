import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { NovaOfertaWizard } from '../_components/NovaOfertaWizard'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams?: { tipo?: 'compra' | 'venda' }
}

export default async function Page({ searchParams }: PageProps) {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const tipoInicial = searchParams?.tipo === 'venda' ? 'venda' : 'compra'
  return (
    <AppShell>
      <PageHeader
        eyebrow="Mesa · Ofertas"
        title="Nova oferta"
        subtitle="Wizard em 3 passos · validade automática"
      />
      <NovaOfertaWizard tipoInicial={tipoInicial} />
    </AppShell>
  )
}
