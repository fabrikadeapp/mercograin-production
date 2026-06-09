import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import { AppShell, PageHeader, EmptyState } from '@/components/ui/phb'
import { Percent } from 'lucide-react'
import { ComissionamentoView } from './_components/ComissionamentoView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Comissionamento' }

export default async function ComissionamentoPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')

  const habilitado = await isFeatureEnabled(scope.workspaceId, 'comissionamento')
  if (!habilitado) {
    return (
      <AppShell>
        <PageHeader eyebrow="Gestão" title="Comissionamento" subtitle="Módulo de comissão de colaborador." />
        <EmptyState
          icon={Percent}
          title="Módulo não habilitado"
          description="O comissionamento de colaborador não está ativo para esta corretora. Fale com o suporte para incluí-lo no seu plano."
        />
      </AppShell>
    )
  }

  const canEdit =
    scope.isAdmin || scope.workspaceRole === 'owner' || scope.workspaceRole === 'admin'

  return (
    <AppShell>
      <PageHeader
        eyebrow="Gestão · Equipe"
        title="Comissionamento"
        subtitle="Defina quais colaboradores são vendedores comissionados e a regra de comissão de cada um."
      />
      <ComissionamentoView canEdit={canEdit} />
    </AppShell>
  )
}
