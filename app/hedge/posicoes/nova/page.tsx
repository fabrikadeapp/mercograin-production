import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import { AppShell, PageHeader, EmptyState } from '@/components/ui/phb'
import { Shield } from 'lucide-react'
import { NovaPosicaoForm } from '../../_components/NovaPosicaoForm'

export const dynamic = 'force-dynamic'

export default async function NovaPosicaoPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')
  if (!(await isFeatureEnabled(scope.workspaceId, 'hedge'))) {
    return (
      <AppShell>
        <PageHeader eyebrow="Hedge" title="Nova posição" subtitle="Registre operação na bolsa." />
        <EmptyState icon={Shield} title="Módulo não disponível no seu plano" description="Hedge & Risco está disponível nos planos Pro e Enterprise. Faça upgrade para habilitar." />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Hedge"
        title="Nova posição"
        subtitle="Long ou Short — registre operação na bolsa (CBOT/B3) com câmbio de entrada."
      />
      <NovaPosicaoForm />
    </AppShell>
  )
}
