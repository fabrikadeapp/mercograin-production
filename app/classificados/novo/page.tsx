import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { NovoClassificadoForm } from './_components/NovoClassificadoForm'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <AppShell>
      <PageHeader
        eyebrow="Marketplace"
        title="Anunciar lote"
        subtitle="Publique uma oferta de compra ou venda"
      />
      <NovoClassificadoForm />
    </AppShell>
  )
}
