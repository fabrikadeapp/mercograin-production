import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { LineChart } from 'lucide-react'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import { db } from '@/lib/db'
import { AppShell, PageHeader, EmptyState } from '@/components/ui/phb'
import { getGrainPrices } from '@/lib/investing-client'
import { SimuladorContent, type CotacoesIniciais, type SimuladorConfigDTO } from './_components/SimuladorContent'

export const dynamic = 'force-dynamic'

type GraoLabel = 'soja' | 'milho' | 'trigo'

export default async function SimuladorCbotPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  if (!(await isFeatureEnabled(scope.workspaceId, 'simulador_cbot'))) {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Mesa · Ferramenta"
          title="Simulador CBOT"
          subtitle="Formação de preço de exportação: CBOT + prêmio + câmbio + frete."
        />
        <EmptyState
          icon={LineChart}
          title="Módulo não disponível no seu plano"
          description="O Simulador CBOT está disponível nos planos Pro e Enterprise. Faça upgrade para habilitar."
        />
      </AppShell>
    )
  }

  // ── Fonte primária: banco (automatizado pelo cron sync-cotacoes) ──────────
  // CBOT ¢/bu (Yahoo) e câmbio USD/BRL (BCB PTAX) são persistidos diariamente.
  const cbot: Record<GraoLabel, number | null> = { soja: null, milho: null, trigo: null }
  let cambio: number | null = null
  let dataCotacao: string | null = null
  // Timestamp real (com hora) da última sincronização dos dados usados.
  let atualizadoEmMs = 0
  let fonteDados: string | null = null

  try {
    const [cotacoes, taxaCambio] = await Promise.all([
      // Última cotação de cada grão (com cbotCents)
      db.cotacao.findMany({
        where: { grao: { in: ['soja', 'milho', 'trigo'] } },
        orderBy: { data: 'desc' },
        distinct: ['grao'],
        take: 3,
        select: {
          grao: true,
          cbotCents: true,
          dolarReal: true,
          data: true,
          updatedAt: true,
          fonte: true,
        },
      }),
      db.taxaCambio.findFirst({
        where: { origem: 'USD', destino: 'BRL' },
        orderBy: { data: 'desc' },
        select: { taxa: true, updatedAt: true, fonte: true },
      }),
    ])

    for (const c of cotacoes) {
      if (c.grao === 'soja' || c.grao === 'milho' || c.grao === 'trigo') {
        cbot[c.grao] = c.cbotCents != null ? Number(c.cbotCents) : null
        if (!dataCotacao) dataCotacao = c.data.toISOString()
        // Considera a cotação na atualização só se ela tem CBOT (dado do simulador).
        if (c.cbotCents != null) {
          atualizadoEmMs = Math.max(atualizadoEmMs, c.updatedAt.getTime())
          if (!fonteDados) fonteDados = c.fonte
        }
      }
    }
    if (taxaCambio?.taxa != null) {
      cambio = Number(taxaCambio.taxa)
      atualizadoEmMs = Math.max(atualizadoEmMs, taxaCambio.updatedAt.getTime())
    }
    // Fallback de câmbio: dolarReal anexado à cotação, se TaxaCambio vazia.
    if (cambio == null) {
      const comDolar = cotacoes.find((c) => c.dolarReal != null)
      if (comDolar?.dolarReal != null) cambio = Number(comDolar.dolarReal)
    }
  } catch (e) {
    // banco indisponível — cai para o fallback de scraping abaixo
  }

  // ── Fallback: scraping ao vivo (Investing) se o banco ainda não tem CBOT ──
  // Acontece antes do primeiro run do cron. Best-effort, não bloqueia a página.
  const semCbot = cbot.soja == null && cbot.milho == null && cbot.trigo == null
  if (semCbot || cambio == null) {
    try {
      const g = await getGrainPrices()
      let usouFallback = false
      if (semCbot) {
        if (g.soja != null) { cbot.soja = cbot.soja ?? g.soja; usouFallback = true }
        if (g.milho != null) { cbot.milho = cbot.milho ?? g.milho; usouFallback = true }
        if (g.trigo != null) { cbot.trigo = cbot.trigo ?? g.trigo; usouFallback = true }
      }
      if (cambio == null && g.taxaCambio != null) { cambio = g.taxaCambio; usouFallback = true }
      // Scraping ao vivo → a "atualização" é agora.
      if (usouFallback) {
        atualizadoEmMs = Date.now()
        fonteDados = fonteDados ?? 'Investing.com (ao vivo)'
      }
    } catch {
      // mantém nulls — UI cai para entrada manual
    }
  }

  // ── Config da mesa (prêmios/fretes/FOBBINGS) salva por workspace ──────────
  let config: SimuladorConfigDTO | null = null
  try {
    const row = await db.simuladorConfig.findUnique({
      where: { workspaceId: scope.workspaceId },
    })
    if (row) {
      config = {
        fobbingsUsdTon: Number(row.fobbingsUsdTon),
        tradings: (row.tradings as unknown as SimuladorConfigDTO['tradings']) ?? [],
        pracas: (row.pracas as unknown as SimuladorConfigDTO['pracas']) ?? [],
      }
    }
  } catch {
    // sem config salva — client usa defaults
  }

  const cotacoesIniciais: CotacoesIniciais = {
    cbot,
    cambio,
    dataCotacao,
    atualizadoEm: atualizadoEmMs > 0 ? new Date(atualizadoEmMs).toISOString() : null,
    fonte: fonteDados,
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Mesa · Ferramenta"
        title="Simulador CBOT"
        subtitle="CBOT + prêmio + FOBBINGS + câmbio + frete → R$/saca por trading e por praça"
      />
      <SimuladorContent cotacoes={cotacoesIniciais} config={config} />
    </AppShell>
  )
}
