import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import { AppShell, PageHeader, Card, EmptyState } from '@/components/ui/phb'
import { FileText } from 'lucide-react'
import { ConfiguracaoForm } from '../_components/ConfiguracaoForm'

export const dynamic = 'force-dynamic'

export default async function ConfiguracaoFiscalPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')
  if (!(await isFeatureEnabled(scope.workspaceId, 'fiscal'))) {
    return (
      <AppShell>
        <PageHeader eyebrow="Fiscal · Configuração" title="Configuração fiscal" subtitle="Emissor, certificado e provider de NF-e." />
        <EmptyState icon={FileText} title="Módulo não disponível no seu plano" description="O módulo Fiscal está disponível no plano Enterprise. Faça upgrade para habilitar." />
      </AppShell>
    )
  }

  const cfg = await db.configuracaoFiscal.findUnique({ where: { workspaceId: scope.workspaceId } })

  return (
    <AppShell>
      <PageHeader
        eyebrow="Fiscal · Configuração"
        title="Configuração fiscal"
        subtitle="Emissor, certificado digital, provider de NF-e e padrões tributários da corretora."
      />
      <ConfiguracaoForm initial={cfg ? JSON.parse(JSON.stringify(cfg)) : null} />
    </AppShell>
  )
}
