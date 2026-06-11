import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import { AppShell, PageHeader, EmptyState } from '@/components/ui/phb'
import { Radar } from 'lucide-react'
import { PanoramaContent } from './_components/PanoramaContent'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Inteligência de Mercado' }

/**
 * Página dedicada "Inteligência de Mercado" — consolida as 6 fontes
 * (USDA PSD, USDA ESR, Boletim Focus, CONAB, dólar PTAX e curva de dólar
 * futuro do Focus) num painel de panorama por grão. Reaproveita o endpoint
 * GET /api/intel/panorama e a feature 'relatorios_usda' (pro/enterprise).
 */
export default async function IntelPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  if (!(await isFeatureEnabled(scope.workspaceId, 'relatorios_usda'))) {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Mesa · Mercado"
          title="Inteligência de Mercado"
          subtitle="Panorama consolidado de oferta/demanda, exportações, câmbio e safra para soja e milho."
        />
        <EmptyState
          icon={Radar}
          title="Módulo não disponível no seu plano"
          description="A Inteligência de Mercado está disponível em planos superiores. Faça upgrade para habilitar o panorama consolidado das fontes USDA, BCB Focus e CONAB."
        />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Mesa · Mercado"
        title="Inteligência de Mercado"
        subtitle="Panorama consolidado das 6 fontes — oferta & demanda (USDA), exportações (ESR), Boletim Focus (BCB), safra brasileira (CONAB) e câmbio presente/futuro."
      />
      <PanoramaContent />
    </AppShell>
  )
}
