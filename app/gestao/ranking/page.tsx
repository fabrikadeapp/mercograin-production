import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { RankingView } from './_components/RankingView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Ranking & Metas' }

export default async function RankingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')
  const canEdit = scope.isAdmin || scope.workspaceRole === 'owner' || scope.workspaceRole === 'admin'
  return (
    <AppShell>
      <PageHeader eyebrow="Gestão · Equipe" title="Ranking & Metas" subtitle="Desempenho dos vendedores no período: volume, comissão e atingimento de meta." />
      <RankingView canEdit={canEdit} />
    </AppShell>
  )
}
