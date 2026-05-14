'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Sparkles, Zap, Filter as FilterIcon } from 'lucide-react'
import Link from 'next/link'
import { ClientesCard } from './ClientesCard'
import { InboxCard } from './InboxCard'
import { PrecosCard } from './PrecosCard'
import { CbotCard } from './CbotCard'
import { PropostasCard } from './PropostasCard'
import { PipelineCard } from './PipelineCard'
import { IndicadoresCard } from './IndicadoresCard'
import { FaturamentoMetaCard } from './FaturamentoMetaCard'
import { HealthCard } from './HealthCard'
import { PropostaDetailDrawer } from './PropostaDetailDrawer'
import { ConversaDrawer } from './ConversaDrawer'
import { DateRangePopover } from './DateRangePopover'
import { FiltrosAvancadosDrawer, FILTROS_VAZIO, countFiltrosAvancadosAtivos, type FiltrosAvancados } from './FiltrosAvancadosDrawer'
import { Chip, FilterBar, FilterLabel, InsightBar, Button } from '@/components/ui/newdb'

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
  const [periodo, setPeriodo] = useState<Periodo>('hoje')
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
      {/* Header — conforme design v2: eyebrow + saudação + serifa inline */}
      <header style={{ paddingTop: 4 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          MESA OPERACIONAL · {eyebrowTimestamp}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
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
      </header>

      {/* InsightBar dinâmico — só renderiza se houver insight relevante */}
      {!insightDismissed && insight?.show && insight.title && (
        <InsightBar
          icon={<Zap style={{ width: 16, height: 16 }} fill="currentColor" />}
          title={insight.title}
          description={insight.description ?? ''}
          actions={
            <>
              <Button variant="ghost" size="sm" onClick={() => setInsightDismissed(true)}>
                Ignorar
              </Button>
              <Link
                href={`/admin/bhgrain/prioridades${insight.commodity ? `?commodity=${insight.commodity}` : ''}`}
                className="btn primary"
                style={{ textDecoration: 'none', fontSize: 12 }}
              >
                <Sparkles style={{ width: 12, height: 12 }} /> Revisar
              </Link>
            </>
          }
        />
      )}

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
            setPeriodo('hoje')
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

      {/* Linha 1 — Inbox + Preços */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InboxCard onOpenConversa={setConversaId} />
        <PrecosCard />
      </div>

      {/* Linha 1.5 — Chicago CBOT (full-width, com seletor de unidade) */}
      <CbotCard />

      {/* Linha 2 — Pipeline (span 2) + Indicadores */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PipelineCard onOpenProposta={openProposta} />
        </div>
        <IndicadoresCard />
      </div>

      {/* Linha 3 — Clientes + Propostas + Faturamento & Meta */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ClientesCard />
        <PropostasCard onOpenProposta={openProposta} />
        <FaturamentoMetaCard />
      </div>

      {/* Linha 4 — Health (horizontal) */}
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
