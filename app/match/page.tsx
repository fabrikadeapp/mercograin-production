import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import { AppShell, PageHeader, EmptyState } from '@/components/ui/phb'
import { GitMerge } from 'lucide-react'
import { MatchView } from './_components/MatchView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Match de ofertas' }

export default async function MatchPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')
  if (!(await isFeatureEnabled(scope.workspaceId, 'match'))) {
    return (
      <AppShell>
        <PageHeader eyebrow="Mesa" title="Match de ofertas" subtitle="Motor de cruzamento oferta × demanda." />
        <EmptyState icon={GitMerge} title="Módulo não habilitado" description="O motor de match não está ativo para esta corretora." />
      </AppShell>
    )
  }
  return (
    <AppShell>
      <PageHeader eyebrow="Mesa · Originação" title="Match de ofertas e demandas" subtitle="Cruzamentos sugeridos entre ofertas de venda e demandas de compra, ordenados por compatibilidade." />
      <MatchView />
    </AppShell>
  )
}
