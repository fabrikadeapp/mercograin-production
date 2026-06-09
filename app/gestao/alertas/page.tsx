import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { AlertasView } from './_components/AlertasView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Alertas comerciais' }

export default async function AlertasPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')
  return (
    <AppShell>
      <PageHeader eyebrow="Gestão · Comercial" title="Alertas comerciais" subtitle="Propostas em risco, preços vencidos, margem baixa, follow-ups e saúde de integrações." />
      <AlertasView />
    </AppShell>
  )
}
