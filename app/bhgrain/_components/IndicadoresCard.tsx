'use client'

import { useState } from 'react'
import { GlassCard, Skeleton, ErrorState, fmtPct, useJson } from './_shared'

interface Resumo {
  enabled?: boolean
  resumo?: {
    indicadores: {
      funil: {
        totalRecebidos: number
        enviadas: number
        emNegociacao: number
        sucesso: number
        recusadas: number
      }
      qualidade: {
        scoreMedio: number | null
        margemMedia: number | null
        propostasCotacaoVencida: number
        followUpsPendentes: number
        tempoMedioRespostaH: number | null
      }
      risco: {
        precoVencido: number
        margemBaixa: number
        paradas: number
        semResposta: number
      }
    }
  }
}

type Tab = 'funil' | 'qualidade' | 'risco'

const TAB_LABEL: Record<Tab, string> = {
  funil: 'Funil',
  qualidade: 'Qualidade',
  risco: 'Risco',
}

export function IndicadoresCard() {
  const { data, error, loading } = useJson<Resumo>('/api/dashboard/resumo')
  const [tab, setTab] = useState<Tab>('funil')

  const ind = data?.resumo?.indicadores
  const total = ind?.funil.totalRecebidos ?? 0
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  return (
    <GlassCard
      title="Indicadores comerciais"
      subtitle="performance do funil · últimos 30 dias"
      action={
        <div className="flex items-center gap-4">
          {(['funil', 'qualidade', 'risco'] as Tab[]).map((t) => {
            const active = tab === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="transition"
                style={{
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--text)' : 'var(--text-mute)',
                  cursor: 'pointer',
                  background: 'transparent',
                  border: 0,
                  padding: 0,
                }}
              >
                {TAB_LABEL[t]}
              </button>
            )
          })}
        </div>
      }
    >
      {loading ? (
        <div className="space-y-3 pt-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-7" />
          ))}
        </div>
      ) : error || !ind ? (
        <ErrorState message="Erro ao carregar indicadores" />
      ) : tab === 'funil' ? (
        <ul className="space-y-3.5 pt-2">
          <BarRow label="Total recebidos" value={ind.funil.totalRecebidos} pct={100} color="var(--accent)" />
          <BarRow
            label="Enviadas"
            value={ind.funil.enviadas}
            pct={pct(ind.funil.enviadas)}
            color="#7FA8FF"
          />
          <BarRow
            label="Em negociação"
            value={ind.funil.emNegociacao}
            pct={pct(ind.funil.emNegociacao)}
            color="#B98AF5"
          />
          <BarRow
            label="Sucesso"
            value={ind.funil.sucesso}
            pct={pct(ind.funil.sucesso)}
            color="var(--success)"
            valueColor="var(--success)"
          />
          <BarRow
            label="Recusadas"
            value={ind.funil.recusadas}
            pct={pct(ind.funil.recusadas)}
            color="var(--danger)"
            valueColor="var(--danger)"
          />
        </ul>
      ) : tab === 'qualidade' ? (
        <ul className="space-y-3.5 pt-2">
          <BarRow
            label="Score médio"
            value={ind.qualidade.scoreMedio ?? 0}
            pct={ind.qualidade.scoreMedio ?? 0}
            color="var(--accent)"
            showPctOnly
          />
          <MetricRow
            label="Margem média"
            value={fmtPct(ind.qualidade.margemMedia)}
            tone={(ind.qualidade.margemMedia ?? 0) >= 5 ? 'success' : 'warn'}
          />
          <MetricRow
            label="Tempo médio resposta"
            value={
              ind.qualidade.tempoMedioRespostaH == null
                ? '—'
                : ind.qualidade.tempoMedioRespostaH < 1
                  ? `${Math.round(ind.qualidade.tempoMedioRespostaH * 60)} min`
                  : ind.qualidade.tempoMedioRespostaH < 48
                    ? `${ind.qualidade.tempoMedioRespostaH.toFixed(1).replace('.', ',')} h`
                    : `${Math.round(ind.qualidade.tempoMedioRespostaH / 24)} d`
            }
          />
          <MetricRow
            label="Cotações vencidas"
            value={ind.qualidade.propostasCotacaoVencida.toString()}
            tone={ind.qualidade.propostasCotacaoVencida > 0 ? 'warn' : 'neutral'}
          />
          <MetricRow
            label="Follow-ups pendentes"
            value={ind.qualidade.followUpsPendentes.toString()}
            tone={ind.qualidade.followUpsPendentes > 0 ? 'warn' : 'neutral'}
          />
        </ul>
      ) : (
        <ul className="space-y-3.5 pt-2">
          <MetricRow
            label="Preço vencido"
            value={ind.risco.precoVencido.toString()}
            tone={ind.risco.precoVencido > 0 ? 'danger' : 'neutral'}
          />
          <MetricRow
            label="Margem baixa"
            value={ind.risco.margemBaixa.toString()}
            tone={ind.risco.margemBaixa > 0 ? 'warn' : 'neutral'}
          />
          <MetricRow
            label="Propostas paradas"
            value={ind.risco.paradas.toString()}
            tone={ind.risco.paradas > 0 ? 'warn' : 'neutral'}
          />
          <MetricRow
            label="Clientes sem resposta"
            value={ind.risco.semResposta.toString()}
            tone={ind.risco.semResposta > 0 ? 'warn' : 'neutral'}
          />
        </ul>
      )}
    </GlassCard>
  )
}

/**
 * Linha do funil com barra de progresso colorida.
 * Layout: label esquerda | barra fill | valor | pct% (dir)
 */
function BarRow({
  label,
  value,
  pct,
  color,
  valueColor,
  showPctOnly,
}: {
  label: string
  value: number
  pct: number
  color: string
  valueColor?: string
  showPctOnly?: boolean
}) {
  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(110px, 0.9fr) 1.6fr auto auto',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--text-mute)' }}>{label}</span>

      <div
        style={{
          height: 8,
          background: 'var(--surface-3)',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.max(0, Math.min(100, pct))}%`,
            height: '100%',
            background: color,
            borderRadius: 999,
            transition: 'width 200ms ease',
          }}
        />
      </div>

      {!showPctOnly && (
        <span
          className="tabular-nums"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: valueColor ?? 'var(--text)',
            minWidth: 28,
            textAlign: 'right',
          }}
        >
          {value}
        </span>
      )}
      <span
        className="tabular-nums"
        style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          fontFamily: 'var(--f-mono)',
          minWidth: 36,
          textAlign: 'right',
        }}
      >
        {pct}%
      </span>
    </li>
  )
}

function MetricRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'success' | 'warn' | 'danger' | 'neutral'
}) {
  const colorMap: Record<string, string> = {
    success: 'var(--success)',
    warn: 'var(--warning)',
    danger: 'var(--danger)',
    neutral: 'var(--text)',
  }
  return (
    <li className="flex items-baseline justify-between" style={{ fontSize: 13 }}>
      <span style={{ color: 'var(--text-mute)' }}>{label}</span>
      <span
        className="tabular-nums"
        style={{ fontSize: 14, fontWeight: 600, color: colorMap[tone] }}
      >
        {value}
      </span>
    </li>
  )
}
