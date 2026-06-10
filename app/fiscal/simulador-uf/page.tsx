import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import { AppShell, PageHeader, Card, EmptyState } from '@/components/ui/phb'
import { FileText } from 'lucide-react'
import { SimuladorClient } from './SimuladorClient'

export const dynamic = 'force-dynamic'

export default async function SimuladorUFPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')
  if (!(await isFeatureEnabled(scope.workspaceId, 'fiscal'))) {
    return (
      <AppShell>
        <PageHeader eyebrow="Fiscal · Simulador" title="Simulador tributário por UF" subtitle="Compara carga tributária entre estados." />
        <EmptyState icon={FileText} title="Módulo não disponível no seu plano" description="O módulo Fiscal está disponível no plano Enterprise. Faça upgrade para habilitar." />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Fiscal · Simulador"
        title="Simulador tributário por UF"
        subtitle="Compara carga tributária (ICMS, PIS, COFINS, IRPJ, CSLL, FUNRURAL) ao operar em diferentes estados. Aproximação — confirme com contador."
      />
      <Card className="p-5">
        <SimuladorClient />
      </Card>
    </AppShell>
  )
}
