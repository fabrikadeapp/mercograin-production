import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Calculator } from 'lucide-react'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import { AppShell, PageHeader, EmptyState } from '@/components/ui/phb'
import { getExchangeRate } from '@/lib/investing-client'
import { fetchCbotQuotes } from '@/lib/quotes/cbot'
import { PremiosContent, type SpotInicial } from './_components/PremiosContent'

export const dynamic = 'force-dynamic'

export default async function SimuladorPremiosPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  if (!(await isFeatureEnabled(scope.workspaceId, 'simulador_premios'))) {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Mesa · Ferramenta"
          title="Calculadora de Prêmios"
          subtitle="Do preço de balcão (R$/saca) ao prêmio implícito (US$/bushel) por trading e mês de vencimento."
        />
        <EmptyState
          icon={Calculator}
          title="Módulo não disponível no seu plano"
          description="A Calculadora de Prêmios está disponível nos planos Pro e Enterprise. Faça upgrade para habilitar."
        />
      </AppShell>
    )
  }

  // ── Pré-carrega câmbio à vista e CBOT à vista (mês corrente / híbrido) ──────
  // Best-effort: cada fonte pode falhar isoladamente sem quebrar a página.
  const [cambioSpot, cbotSpot] = await Promise.all([
    getExchangeRate().catch(() => null),
    fetchCbotQuotes().catch(() => ({ soja: null, milho: null, trigo: null })),
  ])

  // CBOT vem em ¢/bu; a fórmula de prêmio usa Chicago em US$/bu → divide por 100.
  const spot: SpotInicial = {
    cambio: cambioSpot,
    chicagoSojaUsdBu: cbotSpot.soja != null ? cbotSpot.soja / 100 : null,
    // Data base para os rótulos dos meses (mês corrente em diante), no servidor.
    dataBaseISO: new Date().toISOString().slice(0, 10),
    atualizadoEm: new Date().toISOString(),
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Mesa · Ferramenta"
        title="Calculadora de Prêmios"
        subtitle="Preço de balcão (R$/saca) → prêmio implícito (US$/bu) por trading × mês de vencimento"
      />
      <PremiosContent spot={spot} />
    </AppShell>
  )
}
