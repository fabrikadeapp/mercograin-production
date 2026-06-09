import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import { AppShell, PageHeader, EmptyState } from '@/components/ui/phb'
import { FolderOpen } from 'lucide-react'
import { DossieView } from './_components/DossieView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dossiê do negócio' }

export default async function DossiePage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')
  if (!(await isFeatureEnabled(scope.workspaceId, 'dossie'))) {
    return (
      <AppShell>
        <PageHeader eyebrow="Contratos" title="Dossiê do negócio" subtitle="Histórico consolidado." />
        <EmptyState icon={FolderOpen} title="Módulo não habilitado" description="O dossiê do negócio não está ativo para esta corretora." />
      </AppShell>
    )
  }
  return (
    <AppShell>
      <DossieView contratoId={params.id} />
    </AppShell>
  )
}
