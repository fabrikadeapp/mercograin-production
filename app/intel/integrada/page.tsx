import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Layers } from 'lucide-react'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import { db } from '@/lib/db'
import { AppShell, PageHeader, EmptyState } from '@/components/ui/phb'
import { fetchCbotQuotes } from '@/lib/quotes/cbot'
import { getExchangeRate } from '@/lib/investing-client'
import { IntegradaContent, type BaseIntegrada } from './_components/IntegradaContent'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const metadata = { title: 'Análise Integrada' }

const FEATURE = 'relatorios_usda' as const

/**
 * Página "Análise Integrada" — a NOVA visão consolidada de inteligência que
 * MISTURA a camada de PREÇO (calculadoras CBOT/prêmios/fair value via
 * lib/cotacoes/simulador.ts) com o PANORAMA de 6 fontes (USDA, Focus, CONAB,
 * câmbio) servido por GET /api/intel/panorama.
 *
 * Não substitui /intel (panorama puro): é uma visão unificada nova com um
 * "veredito" consolidado no topo. Gating pela feature 'relatorios_usda'
 * (pro/enterprise), mesma de /intel. Pré-carrega CBOT + câmbio ao vivo no
 * servidor para a seção de preço já abrir com fair value calculável.
 */
export default async function IntelIntegradaPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  if (!(await isFeatureEnabled(scope.workspaceId, FEATURE))) {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Mesa · Mercado"
          title="Análise Integrada"
          subtitle="Veredito único que cruza o fair value de preço (CBOT/prêmios) com o panorama das 6 fontes de mercado."
        />
        <EmptyState
          icon={Layers}
          title="Módulo não disponível no seu plano"
          description="A Análise Integrada está disponível nos planos Pro e Enterprise. Faça upgrade para cruzar a camada de preço com a inteligência das fontes USDA, BCB Focus e CONAB."
        />
      </AppShell>
    )
  }

  // ── Pré-carrega câmbio + CBOT ao vivo p/ a seção de preço (fair value) ──────
  // Fonte primária: banco (cron sync-cotacoes). Fallback best-effort: leitura
  // ao vivo. Nada aqui pode derrubar a página — tudo isolado em try/catch.
  const cbot: BaseIntegrada['cbot'] = { soja: null, milho: null }
  let cambio: number | null = null
  let atualizadoEm: string | null = null
  let fonteDados: string | null = null

  try {
    const [cotacoes, taxaCambio] = await Promise.all([
      db.cotacao.findMany({
        where: { grao: { in: ['soja', 'milho'] } },
        orderBy: { data: 'desc' },
        distinct: ['grao'],
        take: 2,
        select: { grao: true, cbotCents: true, dolarReal: true, updatedAt: true, fonte: true },
      }),
      db.taxaCambio.findFirst({
        where: { origem: 'USD', destino: 'BRL' },
        orderBy: { data: 'desc' },
        select: { taxa: true, updatedAt: true },
      }),
    ])

    let maisRecente = 0
    for (const c of cotacoes) {
      if (c.grao === 'soja' || c.grao === 'milho') {
        if (c.cbotCents != null) cbot[c.grao] = Number(c.cbotCents)
        if (cambio === null && c.dolarReal != null && Number(c.dolarReal) > 0) {
          cambio = Number(c.dolarReal)
        }
        const ms = c.updatedAt?.getTime() ?? 0
        if (ms > maisRecente) {
          maisRecente = ms
          fonteDados = c.fonte ?? fonteDados
        }
      }
    }
    if (taxaCambio?.taxa != null && Number(taxaCambio.taxa) > 0) {
      cambio = Number(taxaCambio.taxa)
      const ms = taxaCambio.updatedAt?.getTime() ?? 0
      if (ms > maisRecente) maisRecente = ms
    }
    if (maisRecente > 0) atualizadoEm = new Date(maisRecente).toISOString()
  } catch (err) {
    console.error('[intel/integrada] leitura do banco falhou:', err)
  }

  // Fallback ao vivo quando o banco não tem CBOT/câmbio recentes.
  if (cbot.soja === null || cbot.milho === null || cambio === null) {
    try {
      const [quotesVivo, cambioVivo] = await Promise.all([
        fetchCbotQuotes(),
        cambio === null ? getExchangeRate() : Promise.resolve(cambio),
      ])
      if (cbot.soja === null) cbot.soja = quotesVivo.soja
      if (cbot.milho === null) cbot.milho = quotesVivo.milho
      if (cambio === null && typeof cambioVivo === 'number' && cambioVivo > 0) {
        cambio = cambioVivo
      }
      if (atualizadoEm === null) atualizadoEm = new Date().toISOString()
      fonteDados = fonteDados ?? 'ao vivo'
    } catch (err) {
      console.error('[intel/integrada] fallback ao vivo falhou:', err)
    }
  }

  const base: BaseIntegrada = { cbot, cambio, atualizadoEm, fonteDados }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Mesa · Mercado"
        title="Análise Integrada"
        subtitle="Veredito único cruzando o fair value de preço (CBOT/prêmios) com o panorama de viés das 6 fontes (USDA, Focus, CONAB, câmbio)."
      />
      <IntegradaContent base={base} />
    </AppShell>
  )
}
