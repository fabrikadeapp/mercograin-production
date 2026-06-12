import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Gavel } from 'lucide-react'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import { AppShell, PageHeader, EmptyState } from '@/components/ui/phb'
import { VeredictoContent } from './_components/VeredictoContent'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Veredito de Mercado' }

const FEATURE = 'relatorios_usda' as const

/**
 * Página "Veredito de Mercado" — o produto vendável e HONESTO do BH
 * Intelligence. Cruza 3 ângulos independentes (sazonal · preço vs média ·
 * momentum) e dá um veredito por voto majoritário, SEMPRE exibindo a taxa
 * histórica real de cada sinal e o ganho vs acaso (50%), comprovado em ~25
 * anos. NUNCA promete "75% de acerto" nem "previsão garantida": o teto da
 * direção é ~55-60% e o edge é modesto (+5 a +6pp) mas auditável.
 *
 * Reaproveita o endpoint GET /api/intel/veredito e a feature 'relatorios_usda'
 * (pro/enterprise), mesma das demais telas de inteligência.
 */
export default async function VeredictoPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  if (!(await isFeatureEnabled(scope.workspaceId, FEATURE))) {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Mesa · Mercado"
          title="Veredito de Mercado"
          subtitle="Três ângulos independentes (sazonal, preço vs média e momentum) com sua taxa real comprovada em 25 anos — você decide melhor informado."
        />
        <EmptyState
          icon={Gavel}
          title="Módulo não disponível no seu plano"
          description="O Veredito de Mercado está disponível nos planos Pro e Enterprise. Faça upgrade para cruzar os 3 ângulos comprovados e ler o veredito consolidado por grão."
        />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Mesa · Mercado"
        title="Veredito de Mercado"
        subtitle="Três ângulos independentes (sazonal, preço vs média 12m e momentum) votam um veredito — cada um com sua taxa real e ganho vs acaso, comprovados em 25 anos."
      />
      <VeredictoContent />
    </AppShell>
  )
}
