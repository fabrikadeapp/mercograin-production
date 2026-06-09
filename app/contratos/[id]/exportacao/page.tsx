import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import { AppShell, PageHeader, EmptyState } from '@/components/ui/phb'
import { Ship } from 'lucide-react'
import { ChecklistView } from './_components/ChecklistView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Checklist de exportação' }

export default async function ExportacaoPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')
  if (!(await isFeatureEnabled(scope.workspaceId, 'eudr'))) {
    return (
      <AppShell>
        <PageHeader eyebrow="Exportação" title="Checklist documental" subtitle="Acompanhamento de documentos de exportação." />
        <EmptyState icon={Ship} title="Módulo não habilitado" description="O módulo de exportação (EUDR) não está ativo para esta corretora." />
      </AppShell>
    )
  }
  return (
    <AppShell>
      <PageHeader eyebrow="Exportação · Documentos" title="Checklist de exportação" subtitle="DUE, fitossanitário, BL, booking e demais documentos do embarque." />
      <ChecklistView contratoId={params.id} />
    </AppShell>
  )
}
