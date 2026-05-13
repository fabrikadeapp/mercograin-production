'use client'

import { useState } from 'react'
import { GlassCard, Skeleton, ErrorState, fmtPct, useJson } from './_shared'

interface Resumo {
  enabled?: boolean
  resumo?: {
    indicadores: {
      funil: { totalRecebidos: number; enviadas: number; emNegociacao: number; sucesso: number; recusadas: number }
      qualidade: { scoreMedio: number | null; margemMedia: number | null; propostasCotacaoVencida: number; followUpsPendentes: number }
      risco: { precoVencido: number; margemBaixa: number; paradas: number; semResposta: number }
    }
  }
}

type Tab = 'funil' | 'qualidade' | 'risco'

export function IndicadoresCard() {
  const { data, error, loading } = useJson<Resumo>('/api/dashboard/resumo')
  const [tab, setTab] = useState<Tab>('funil')

  const ind = data?.resumo?.indicadores
  const total = ind?.funil.totalRecebidos ?? 0
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  return (
    <GlassCard title="Indicadores comerciais" subtitle="Performance do funil">
      <div className="flex items-center gap-1 mb-3">
        {(['funil', 'qualidade', 'risco'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="text-[11px] px-2.5 py-1 rounded-full capitalize transition"
            style={{
              background: tab === t ? 'var(--vg-accent-primary)' : 'var(--vg-glass-pill-track)',
              color: tab === t ? '#fff' : 'var(--vg-fg-2)',
              fontWeight: tab === t ? 600 : 400,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8" />)}
        </div>
      ) : error || !ind ? (
        <ErrorState message="Erro ao carregar indicadores" />
      ) : tab === 'funil' ? (
        <ul className="space-y-2.5">
          <Row label="Total recebidos" value={ind.funil.totalRecebidos} pct={100} tone="info" />
          <Row label="Enviadas" value={ind.funil.enviadas} pct={pct(ind.funil.enviadas)} tone="info" />
          <Row label="Em negociação" value={ind.funil.emNegociacao} pct={pct(ind.funil.emNegociacao)} tone="warn" />
          <Row label="Sucesso" value={ind.funil.sucesso} pct={pct(ind.funil.sucesso)} tone="success" />
          <Row label="Recusadas" value={ind.funil.recusadas} pct={pct(ind.funil.recusadas)} tone="danger" />
        </ul>
      ) : tab === 'qualidade' ? (
        <ul className="space-y-2.5">
          <MetricRow label="Score médio" value={ind.qualidade.scoreMedio != null ? `${ind.qualidade.scoreMedio}%` : '—'} />
          <MetricRow label="Margem média" value={fmtPct(ind.qualidade.margemMedia)} />
          <MetricRow label="Cotações vencidas" value={ind.qualidade.propostasCotacaoVencida.toString()} />
          <MetricRow label="Follow-ups pendentes" value={ind.qualidade.followUpsPendentes.toString()} />
        </ul>
      ) : (
        <ul className="space-y-2.5">
          <MetricRow label="Preço vencido" value={ind.risco.precoVencido.toString()} tone={ind.risco.precoVencido > 0 ? 'danger' : 'neutral'} />
          <MetricRow label="Margem baixa" value={ind.risco.margemBaixa.toString()} tone={ind.risco.margemBaixa > 0 ? 'warn' : 'neutral'} />
          <MetricRow label="Propostas paradas" value={ind.risco.paradas.toString()} tone={ind.risco.paradas > 0 ? 'warn' : 'neutral'} />
          <MetricRow label="Clientes sem resposta" value={ind.risco.semResposta.toString()} tone={ind.risco.semResposta > 0 ? 'warn' : 'neutral'} />
        </ul>
      )}
    </GlassCard>
  )
}

function Row({ label, value, pct, tone }: { label: string; value: number; pct: number; tone: 'info' | 'warn' | 'success' | 'danger' }) {
  const colorMap = {
    info: 'var(--vg-accent-primary)',
    warn: '#f59e0b',
    success: 'var(--vg-success, #10b981)',
    danger: 'var(--vg-destructive, #ef4444)',
  }
  return (
    <li>
      <div className="flex items-baseline justify-between text-[12px] mb-1">
        <span className="text-vg-fg-2">{label}</span>
        <span className="tabular-nums font-semibold">{value} <span className="text-vg-fg-3 font-normal">· {pct}%</span></span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--vg-glass-pill-track)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colorMap[tone] }} />
      </div>
    </li>
  )
}

function MetricRow({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'success' | 'warn' | 'danger' | 'neutral' }) {
  const colorMap: Record<string, string> = {
    success: 'var(--vg-success, #10b981)',
    warn: '#f59e0b',
    danger: 'var(--vg-destructive, #ef4444)',
    neutral: 'var(--vg-fg-primary)',
  }
  return (
    <li className="flex items-baseline justify-between text-[12px] py-1">
      <span className="text-vg-fg-2">{label}</span>
      <span className="font-semibold tabular-nums" style={{ color: colorMap[tone] }}>{value}</span>
    </li>
  )
}
