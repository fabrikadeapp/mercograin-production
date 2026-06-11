import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import { db } from '@/lib/db'
import { AppShell, PageHeader, EmptyState } from '@/components/ui/phb'
import { FileBarChart } from 'lucide-react'
import { relatorioExemplo } from '@/lib/usda/relatorio'
import { RelatorioUsdaContent } from './_components/RelatorioUsdaContent'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Relatório USDA' }

export default async function RelatoriosUsdaPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  if (!(await isFeatureEnabled(scope.workspaceId, 'relatorios_usda'))) {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Mesa · Mercado"
          title="Relatório USDA"
          subtitle="Projeções WASDE/PSD de soja e milho, com variação mensal e anual."
        />
        <EmptyState
          icon={FileBarChart}
          title="Módulo não disponível no seu plano"
          description="O Relatório USDA está disponível em planos superiores. Faça upgrade para habilitar a geração de relatórios."
        />
      </AppShell>
    )
  }

  // Branding do workspace (corretora) para o cabeçalho do preview.
  const empresa = await db.dadosEmpresa.findFirst({
    where: { workspaceId: scope.workspaceId },
    select: { logoUrl: true, razaoSocial: true, nomeFantasia: true },
  })
  const workspace = await db.workspace.findUnique({
    where: { id: scope.workspaceId },
    select: { name: true },
  })

  const brandNome =
    empresa?.nomeFantasia || empresa?.razaoSocial || workspace?.name || 'Mercograin'

  // Pré-gera um relatório de exemplo para o preview inicial (sem persistir).
  const exemplo = relatorioExemplo(new Date().toISOString())

  return (
    <AppShell>
      <PageHeader
        eyebrow="Mesa · Mercado"
        title="Relatório USDA"
        subtitle="Configure grãos, seções e métricas para gerar projeções WASDE/PSD com variação mensal e anual. Exporte em PNG, PDF ou link público."
      />
      <RelatorioUsdaContent
        relatorioInicial={exemplo}
        brandNome={brandNome}
        brandLogoUrl={empresa?.logoUrl ?? null}
      />
    </AppShell>
  )
}
