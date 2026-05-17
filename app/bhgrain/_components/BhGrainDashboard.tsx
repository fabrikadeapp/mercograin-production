'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Sparkles, Zap, Filter as FilterIcon } from 'lucide-react'
import Link from 'next/link'
import { PropostasAguardandoCard } from './PropostasAguardandoCard'
import { InboxCard } from './InboxCard'
import { PrecosCard } from './PrecosCard'
import { PropostasCard } from './PropostasCard'
import { PipelineCard } from './PipelineCard'
import { IndicadoresCard } from './IndicadoresCard'
import { FaturamentoMetaCard } from './FaturamentoMetaCard'
import { HealthCard } from './HealthCard'
import { PropostaDetailDrawer } from './PropostaDetailDrawer'
import { ConversaDrawer } from './ConversaDrawer'
import { DateRangePopover } from './DateRangePopover'
import { FiltrosAvancadosDrawer, FILTROS_VAZIO, countFiltrosAvancadosAtivos, type FiltrosAvancados } from './FiltrosAvancadosDrawer'
import { Chip, FilterBar, FilterLabel } from '@/components/ui/newdb'
import { DashboardFiltersProvider } from './DashboardFiltersContext'

interface Props {
  firstName: string
  workspaceName: string
}

type Periodo = 'hoje' | '7d' | '15d' | '30d' | 'custom'
type Commodity = 'todas' | 'soja' | 'milho' | 'trigo'

const PERIOD_LABEL: Record<Exclude<Periodo, 'custom'>, string> = {
  hoje: 'Hoje',
  '7d': '7 dias',
  '15d': '15 dias',
  '30d': '30 dias',
}

interface InsightData {
  show: boolean
  title?: string
  description?: string
  commodity?: string
  variacaoPct?: number
  propostasCount?: number
}

export function BhGrainDashboard({ firstName, workspaceName: _workspaceName }: Props) {
  const [propostaId, setPropostaId] = useState<string | null>(null)
  const [conversaId, setConversaId] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>('30d')
  const [commodity, setCommodity] = useState<Commodity>('todas')
  const [insightDismissed, setInsightDismissed] = useState(false)
  const [insight, setInsight] = useState<InsightData | null>(null)
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null)
  const [filtrosAvancados, setFiltrosAvancados] = useState<FiltrosAvancados>(FILTROS_VAZIO)
  const [drawerAvancadoOpen, setDrawerAvancadoOpen] = useState(false)

  // Insight dinâmico
  useEffect(() => {
    fetch('/api/bhgrain/insight')
      .then((r) => r.json())
      .then((j) => setInsight(j as InsightData))
      .catch(() => setInsight({ show: false }))
  }, [])

  const openProposta = useCallback((id: string) => setPropostaId(id), [])

  const eyebrowTimestamp = useMemo(() => {
    const d = new Date()
    const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return `${data.toUpperCase()}, ${hora}`
  }, [])

  const greetingHour = new Date().getHours()
  const greeting = greetingHour < 12 ? 'Bom dia' : greetingHour < 18 ? 'Boa tarde' : 'Boa noite'
  const filtrosCount = countFiltrosAvancadosAtivos(filtrosAvancados)

  return (
    <div className="space-y-4">
      {/* Header — saudação à esquerda + insight IA compacto à direita */}
      <header style={{ paddingTop: 4 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          MESA OPERACIONAL · {eyebrowTimestamp}
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
            <h1
              style={{
                fontSize: 36,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              {greeting}, {firstName}.
            </h1>
            <span
              className="t-serif"
              style={{
                fontSize: 28,
                fontFamily: 'var(--f-serif)',
                fontStyle: 'italic',
                color: 'var(--text-mute)',
                lineHeight: 1.2,
                letterSpacing: '-0.01em',
              }}
            >
              Aqui está o que importa hoje.
            </span>
          </div>

          {/* Insight IA — chip compacto ao lado da saudação */}
          {!insightDismissed && insight?.show && insight.title && (
            <div
              className="flex items-center gap-2 shrink-0"
              style={{
                background: 'var(--surface-2, rgba(255,255,255,0.04))',
                border: '1px solid var(--border, rgba(255,255,255,0.08))',
                borderRadius: 999,
                padding: '6px 10px 6px 8px',
                maxWidth: 520,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  background: 'var(--accent)',
                  color: 'var(--accent-ink)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Zap style={{ width: 11, height: 11 }} fill="currentColor" />
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 320,
                }}
                title={insight.title + (insight.description ? ` — ${insight.description}` : '')}
              >
                {insight.title}
              </span>
              <button
                type="button"
                onClick={() => setInsightDismissed(true)}
                style={{
                  background: 'transparent',
                  border: 0,
                  color: 'var(--text-mute)',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: '0 4px',
                }}
                aria-label="Ignorar dica"
              >
                ×
              </button>
              <Link
                href={`/admin/bhgrain/prioridades${insight.commodity ? `?commodity=${insight.commodity}` : ''}`}
                style={{
                  background: 'var(--accent)',
                  color: 'var(--accent-ink)',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 9px',
                  borderRadius: 999,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Sparkles style={{ width: 10, height: 10 }} />
                Revisar
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* FilterBar — conforme design: período (incl. Personalizar) + commodity + Filtros avançados */}
      <FilterBar
        right={
          <button
            type="button"
            className="btn ghost"
            onClick={() => setDrawerAvancadoOpen(true)}
            style={{ padding: '6px 12px', fontSize: 12 }}
          >
            <FilterIcon style={{ width: 12, height: 12 }} />
            Filtros avançados
            {filtrosCount > 0 && (
              <span
                style={{
                  marginLeft: 4,
                  background: 'var(--accent)',
                  color: 'var(--accent-ink)',
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 999,
                  padding: '1px 6px',
                }}
              >
                {filtrosCount}
              </span>
            )}
          </button>
        }
      >
        <FilterLabel>PERÍODO</FilterLabel>
        {(Object.keys(PERIOD_LABEL) as (keyof typeof PERIOD_LABEL)[]).map((p) => (
          <Chip
            key={p}
            active={periodo === p}
            onClick={() => {
              setPeriodo(p)
              setCustomRange(null)
            }}
          >
            {PERIOD_LABEL[p]}
          </Chip>
        ))}
        <DateRangePopover
          active={periodo === 'custom' && !!customRange}
          startDate={customRange?.start ?? null}
          endDate={customRange?.end ?? null}
          onApply={(start, end) => {
            setCustomRange({ start, end })
            setPeriodo('custom')
          }}
          onClear={() => {
            setCustomRange(null)
            setPeriodo('30d')
          }}
        />
        <div className="sep" />
        <FilterLabel>COMMODITY</FilterLabel>
        {(['todas', 'soja', 'milho', 'trigo'] as Commodity[]).map((c) => (
          <Chip key={c} active={commodity === c} onClick={() => setCommodity(c)}>
            {c === 'todas' ? 'Todas' : c[0].toUpperCase() + c.slice(1)}
          </Chip>
        ))}
      </FilterBar>

      {/*
        Nova organização (conforme briefing):
        - Linha 1: Inbox unificado (esq) + Preços ao vivo (dir)
        - Linha 2: Pipeline de propostas (esq, span 2) + Indicadores comerciais (dir)
        - Linha 3: Clientes + Propostas + Faturamento & Meta (3 col)
        - Linha 4: Health de integrações (horizontal full-width)

        Mobile mantém ordem priorizada: Inbox → Propostas → Pipeline → Preços → Clientes → Indicadores → Faturamento.
      */}

      {/* Linha 1 — Inbox + Preços (com abas Spot/CBOT/Câmbio integradas).
          Não reagem aos filtros do dashboard (são streams independentes). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InboxCard onOpenConversa={setConversaId} />
        <PrecosCard />
      </div>

      {/* Cards que reagem ao FilterBar: Pipeline, Indicadores, Clientes,
          Propostas, Faturamento. Tudo dentro do Provider compartilhado. */}
      <DashboardFiltersProvider state={{ periodo, commodity, customRange }}>
        {/* Linha 2 — Pipeline (span 2) + Indicadores */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <PipelineCard onOpenProposta={openProposta} />
          </div>
          <IndicadoresCard />
        </div>

        {/* Linha 3 — Aguardando envio + Enviadas + Faturamento & Meta
            (Clientes movido pra navbar — acessível por Mesa → Clientes) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <PropostasAguardandoCard onOpenProposta={openProposta} />
          <PropostasCard onOpenProposta={openProposta} />
          <FaturamentoMetaCard />
        </div>
      </DashboardFiltersProvider>

      {/* Linha 4 — Health (horizontal). Não filtra. */}
      <HealthCard />

      <PropostaDetailDrawer propostaId={propostaId} onClose={() => setPropostaId(null)} />
      <ConversaDrawer conversationId={conversaId} onClose={() => setConversaId(null)} />
      <FiltrosAvancadosDrawer
        open={drawerAvancadoOpen}
        onClose={() => setDrawerAvancadoOpen(false)}
        initial={filtrosAvancados}
        onApply={setFiltrosAvancados}
      />
    </div>
  )
}
