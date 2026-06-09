import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/auth/scope'
import { AppShell } from '@/components/ui/phb'
import { ContasView } from '../_components/ContasView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Contas a Receber' }

export default async function ReceberPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')
  return (
    <AppShell>
      <ContasView tipo="receita" />
    </AppShell>
  )
}
