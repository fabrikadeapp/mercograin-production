import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Calculator } from 'lucide-react'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import { db } from '@/lib/db'
import { AppShell, PageHeader, EmptyState } from '@/components/ui/phb'
import { fetchCbotQuotes } from '@/lib/quotes/cbot'
import { getExchangeRate } from '@/lib/investing-client'
import { MesaContent, type BaseInicial } from './_components/MesaContent'

export const dynamic = 'force-dynamic'

type GraoLabel = 'soja' | 'milho' | 'trigo'

export default async function CalculadoraMesaPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  if (!(await isFeatureEnabled(scope.workspaceId, 'calculadora_mesa'))) {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Mesa · Ferramenta"
          title="Calculadora de Mesa"
          subtitle="Mesa unificada: prêmio→preço e preço→prêmio lado a lado, com spread por trading."
        />
        <EmptyState
          icon={Calculator}
          title="Módulo não disponível no seu plano"
          description="A Calculadora de Mesa Integrada está disponível nos planos Pro e Enterprise. Faça upgrade para habilitar."
        />
      </AppShell>
    )
  }

  // ── Pré-carrega câmbio + CBOT ao vivo para preencher os parâmetros base ─────
  // Fonte primária: banco (cron sync-cotacoes). Fallback: leitura ao vivo.
  const cbot: Record<GraoLabel, number | null> = { soja: null, milho: null, trigo: null }
  let cambio: number | null = null
  let atualizadoEmMs = 0
  let fonteDados: string | null = null

  try {
    const [cotacoes, taxaCambio] = await Promise.all([
      db.cotacao.findMany({
        where: { grao: { in: ['soja', 'milho', 'trigo'] } },
        orderBy: { data: 'desc' },
        distinct: ['grao'],
        take: 3,
        select: { grao: true, cbotCents: true, dolarReal: true, updatedAt: true, fonte: true },
      }),
      db.taxaCambio.findFirst({
        where: { origem: 'USD', destino: 'BRL' },
        orderBy: { data: 'desc' },
        select: { taxa: true, updatedAt: true },
      }),
    ])

    for (const c of cotacoes) {
      if (c.grao === 'soja' || c.grao === 'milho' || c.grao === 'trigo') {
        cbot[c.grao] = c.cbotCents != null ? Number(c.cbotCents) : null
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
    if (cambio == null) {
      const comDolar = cotacoes.find((c) => c.dolarReal != null)
      if (comDolar?.dolarReal != null) cambio = Number(comDolar.dolarReal)
    }
  } catch {
    // banco indisponível — cai para o fallback ao vivo abaixo
  }

  // ── Fallback ao vivo (Yahoo CBOT + câmbio) se o banco ainda não tem dados ───
  const semCbot = cbot.soja == null && cbot.milho == null && cbot.trigo == null
  if (semCbot || cambio == null) {
    try {
      const [cbotLive, cambioLive] = await Promise.all([
        semCbot ? fetchCbotQuotes() : Promise.resolve(null),
        cambio == null ? getExchangeRate() : Promise.resolve(cambio),
      ])
      let usouFallback = false
      if (cbotLive) {
        if (cbotLive.soja != null) { cbot.soja = cbot.soja ?? cbotLive.soja; usouFallback = true }
        if (cbotLive.milho != null) { cbot.milho = cbot.milho ?? cbotLive.milho; usouFallback = true }
        if (cbotLive.trigo != null) { cbot.trigo = cbot.trigo ?? cbotLive.trigo; usouFallback = true }
      }
      if (cambio == null && cambioLive != null) { cambio = cambioLive; usouFallback = true }
      if (usouFallback) {
        atualizadoEmMs = Date.now()
        fonteDados = fonteDados ?? 'Yahoo Finance + Investing.com (ao vivo)'
      }
    } catch {
      // mantém nulls — a tela cai para entrada manual
    }
  }

  const base: BaseInicial = {
    cbot,
    cambio,
    atualizadoEm: atualizadoEmMs > 0 ? new Date(atualizadoEmMs).toISOString() : null,
    fonte: fonteDados,
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Mesa · Ferramenta"
        title="Calculadora de Mesa Integrada"
        subtitle="Prêmio→preço e preço→prêmio lado a lado por trading, com spread implícito e melhor oportunidade."
      />
      <MesaContent base={base} />
    </AppShell>
  )
}
