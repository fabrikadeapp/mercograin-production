import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { AlertasPrecoView } from './_components/AlertasPrecoView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Alertas de preço' }

export default async function AlertasPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')
  return (
    <AppShell>
      <PageHeader eyebrow="Mesa · Mercado" title="Alertas de preço" subtitle="Seja avisado quando a cotação de um grão cruzar o valor que você definir." />
      <AlertasPrecoView />
    </AppShell>
  )
}
