'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Bell, Sparkles, Zap, Filter as FilterIcon } from 'lucide-react'
import Link from 'next/link'
import { ClientesCard } from './ClientesCard'
import { InboxCard } from './InboxCard'
import { PrecosCard } from './PrecosCard'
import { PropostasCard } from './PropostasCard'
import { PipelineCard } from './PipelineCard'
import { IndicadoresCard } from './IndicadoresCard'
import { FaturamentoMetaCard } from './FaturamentoMetaCard'
import { HealthCard } from './HealthCard'
import { PropostaDetailDrawer } from './PropostaDetailDrawer'
import { ConversaDrawer } from './ConversaDrawer'
import { Chip, FilterBar, FilterLabel, InsightBar, Button } from '@/components/ui/newdb'

interface Props {
  firstName: string
  workspaceName: string
}

type Periodo = 'hoje' | '7d' | '15d' | '30d'
type Commodity = 'todas' | 'soja' | 'milho' | 'trigo'

const PERIOD_LABEL: Record<Periodo, string> = {
  hoje: 'Hoje',
  '7d': '7 dias',
  '15d': '15 dias',
  '30d': '30 dias',
}

export function BhGrainDashboard({ firstName, workspaceName }: Props) {
  const [propostaId, setPropostaId] = useState<string | null>(null)
  const [conversaId, setConversaId] = useState<string | null>(null)
  const [alertasCount, setAlertasCount] = useState<number>(0)
  const [periodo, setPeriodo] = useState<Periodo>('hoje')
  const [commodity, setCommodity] = useState<Commodity>('todas')
  const [insightDismissed, setInsightDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard/resumo')
      .then((r) => r.json())
      .then((j) => {
        if (j.enabled && j.resumo) setAlertasCount(j.resumo.alertasAbertos ?? 0)
      })
      .catch(() => {})
  }, [])

  const openProposta = useCallback((id: string) => setPropostaId(id), [])

  const eyebrowTimestamp = useMemo(() => {
    const d = new Date()
    return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  }, [])

  const greetingHour = new Date().getHours()
  const greeting = greetingHour < 12 ? 'Bom dia' : greetingHour < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="space-y-4">
      {/* Header NewDB v2
          - Linha 1: eyebrow mono + "Bom dia, Admin." + workspace + alertas
          - Linha 2: "Aqui está o que importa hoje." em Instrument Serif italic */}
      <header className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="eyebrow">MESA OPERACIONAL · {eyebrowTimestamp}</div>
            <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', margin: '4px 0 0' }}>
              {greeting}, {firstName}.
            </h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span style={{ color: 'var(--text-mute)', fontSize: 13 }}>{workspaceName}</span>
            {alertasCount > 0 && (
              <Link
                href="/admin/bhgrain/alertas"
                className="badge danger"
                style={{ textDecoration: 'none', padding: '6px 12px', fontSize: 12 }}
              >
                <Bell className="w-3 h-3" /> {alertasCount} alertas
              </Link>
            )}
          </div>
        </div>
        <div
          className="t-serif"
          style={{ fontSize: 18, color: 'var(--text-mute)', letterSpacing: '-0.01em' }}
        >
          Aqui está o que importa hoje.
        </div>
      </header>

      {/* Insight bar — lime translúcido, "what to do now" */}
      {!insightDismissed && (
        <InsightBar
          icon={<Zap style={{ width: 16, height: 16 }} fill="currentColor" />}
          title="Reveja propostas com prioridade IA antes de fechar o dia"
          description="A IA destacou propostas com alta chance de fechamento — abra Prioridades para a lista priorizada"
          actions={
            <>
              <Button variant="ghost" size="sm" onClick={() => setInsightDismissed(true)}>
                Ignorar
              </Button>
              <Link href="#" className="btn primary" style={{ textDecoration: 'none', fontSize: 12 }}>
                <Sparkles style={{ width: 12, height: 12 }} /> Ver prioridades
              </Link>
            </>
          }
        />
      )}

      {/* Filter bar — chips período + commodity */}
      <FilterBar
        right={
          <button className="btn ghost" style={{ padding: '6px 12px', fontSize: 12 }}>
            <FilterIcon style={{ width: 12, height: 12 }} /> Filtros avançados
          </button>
        }
      >
        <FilterLabel>PERÍODO</FilterLabel>
        {(Object.keys(PERIOD_LABEL) as Periodo[]).map((p) => (
          <Chip key={p} active={periodo === p} onClick={() => setPeriodo(p)}>
            {PERIOD_LABEL[p]}
          </Chip>
        ))}
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
    </div>
  )
}
