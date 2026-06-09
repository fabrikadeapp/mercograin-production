import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/auth/scope'
import { AppShell } from '@/components/ui/phb'
import { LeadsView } from '../_components/LeadsView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Novo Lead' }

/** /leads/novo — abre o funil de leads já com o modal de cadastro aberto. */
export default async function NovoLeadPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')
  return (
    <AppShell>
      <LeadsView abrirNovo />
    </AppShell>
  )
}
