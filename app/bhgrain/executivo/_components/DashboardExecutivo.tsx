'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Phone,
  MessageCircle,
  Bot,
  Globe,
} from 'lucide-react'
import { GlassCard } from '@/app/bhgrain/_components/_shared'
import { SaudeCardCompacto } from './SaudeCardCompacto'

interface DashboardData {
  mes: { receita: number; count: number; ticketMedio: number; hitRate: number }
  mesAnterior: { receita: number; count: number; ticketMedio: number; hitRate: number }
  tendencia6m: { mes: string; receita: number; count: number; hitRate: number }[]
  hitRatePorCanal: {
    canal: string
    hitRate: number
    ganhas: number
    decididas: number
    receita: number
  }[]
  topClientes: { clienteId: string; nome: string; receita: number; count: number }[]
  funil: {
    rascunho: number
    enviada: number
    em_negociacao: number
    aceita: number
    perdida: number
  }
}

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`

const CANAL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  telefone: Phone,
  whatsapp: MessageCircle,
  ia_autonomo: Bot,
  web: Globe,
}

const CANAL_LABEL: Record<string, string> = {
  telefone: 'Telefone',
  whatsapp: 'WhatsApp',
  ia_autonomo: 'IA autônoma',
  web: 'Web',
}

interface Props {
  workspaceName: string
}

export function DashboardExecutivo({ workspaceName }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/bhgrain/dashboard-exec')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && typeof j === 'object' && 'mes' in j) setData(j as DashboardData)
      })
      .finally(() => setLoading(false))
  }, [])

  const deltaReceita = useMemo(() => {
    if (!data) return null
    const prev = data.mesAnterior.receita
    const now = data.mes.receita
    if (prev === 0) return now > 0 ? 1 : 0
    return (now - prev) / prev
  }, [data])

  const deltaCount = useMemo(() => {
    if (!data) return null
    const prev = data.mesAnterior.count
    const now = data.mes.count
    if (prev === 0) return now > 0 ? 1 : 0
    return (now - prev) / prev
  }, [data])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg"
            style={{ background: 'var(--surface-2)' }}
          />
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12" style={{ color: 'var(--text-dim)' }}>
        Não foi possível carregar o dashboard.
      </div>
    )
  }

  // Funil ordenado: rascunho > enviada > em_negociacao > aceita
  const funilData = [
    { etapa: 'Rascunho', valor: data.funil.rascunho, cor: 'var(--text-dim)' },
    { etapa: 'Enviada', valor: data.funil.enviada, cor: 'var(--info)' },
    { etapa: 'Em negociação', valor: data.funil.em_negociacao, cor: 'var(--warning)' },
    { etapa: 'Aceita', valor: data.funil.aceita, cor: 'var(--success)' },
    { etapa: 'Perdida', valor: data.funil.perdida, cor: 'var(--danger)' },
  ]

  return (
    <div className="space-y-6">
      <header className="pb-2">
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          {workspaceName.toUpperCase()} · VISÃO EXECUTIVA
        </div>
        <h1
          style={{
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          Dashboard executivo
        </h1>
        <p
          style={{
            marginTop: 6,
            fontSize: 13,
            color: 'var(--text-mute)',
          }}
        >
          Visão de dono · mês atual versus anterior · últimos 6 meses · todos os canais.
        </p>
      </header>

      {/* Linha 1 — KPIs do mês */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCardExec
          label="Receita do mês"
          valor={fmt(data.mes.receita)}
          delta={deltaReceita}
          sub={`vs ${fmt(data.mesAnterior.receita)} no mês anterior`}
        />
        <KpiCardExec
          label="Propostas fechadas"
          valor={data.mes.count.toString()}
          delta={deltaCount}
          sub={`vs ${data.mesAnterior.count} no mês anterior`}
        />
        <KpiCardExec
          label="Ticket médio"
          valor={fmt(data.mes.ticketMedio)}
          delta={null}
          sub={`vs ${fmt(data.mesAnterior.ticketMedio)} no mês anterior`}
        />
        <KpiCardExec
          label="Hit rate mensal"
          valor={fmtPct(data.mes.hitRate)}
          delta={null}
          sub={`vs ${fmtPct(data.mesAnterior.hitRate)} no mês anterior`}
        />
      </div>

      {/* Linha 2 — Tendência receita 6m */}
      <GlassCard
        title="Tendência de receita · 6 meses"
        subtitle="Soma das propostas fechadas em cada mês"
      >
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <AreaChart
              data={data.tendencia6m.map((m) => ({
                ...m,
                mesLabel: formatMesLabel(m.mes),
              }))}
              margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mesLabel" stroke="var(--text-dim)" fontSize={11} />
              <YAxis
                stroke="var(--text-dim)"
                fontSize={11}
                tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v) => [fmt(Number(v)), 'Receita']}
              />
              <Area
                type="monotone"
                dataKey="receita"
                stroke="var(--accent)"
                fill="url(#gradReceita)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Hit rate por canal */}
        <GlassCard
          title="Hit rate por canal"
          subtitle="Onde sua proposta converte melhor?"
        >
          {data.hitRatePorCanal.length === 0 ? (
            <p className="text-center py-8" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              Sem dados nos últimos 6 meses.
            </p>
          ) : (
            <div className="space-y-3">
              {data.hitRatePorCanal.map((c) => {
                const Icon = CANAL_ICON[c.canal] ?? Globe
                return (
                  <div key={c.canal}>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="flex items-center gap-1.5"
                        style={{ fontSize: 13 }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {CANAL_LABEL[c.canal] ?? c.canal}
                        <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                          {c.ganhas}/{c.decididas} · {fmt(c.receita)}
                        </span>
                      </span>
                      <span
                        className="font-semibold tabular-nums"
                        style={{ fontSize: 13, color: 'var(--accent)' }}
                      >
                        {fmtPct(c.hitRate)}
                      </span>
                    </div>
                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, c.hitRate * 100)}%`,
                          height: '100%',
                          background: 'var(--accent)',
                          transition: 'width 300ms ease',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </GlassCard>

        {/* Funil */}
        <GlassCard
          title="Funil — status corrente"
          subtitle="Onde estão suas propostas neste exato momento"
        >
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={funilData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-dim)" fontSize={11} />
                <YAxis
                  dataKey="etapa"
                  type="category"
                  stroke="var(--text-dim)"
                  fontSize={11}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="valor" radius={[0, 6, 6, 0]}>
                  {funilData.map((d, i) => (
                    <Cell key={i} fill={d.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* Saúde das notificações (compacto) */}
      <SaudeCardCompacto />

      {/* Top clientes */}
      <GlassCard
        title="Top 10 clientes · 6 meses"
        subtitle="Receita acumulada das propostas fechadas"
      >
        {data.topClientes.length === 0 ? (
          <p className="text-center py-8" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
            Sem fechamentos nos últimos 6 meses.
          </p>
        ) : (
          <div className="space-y-2">
            {data.topClientes.map((c, i) => {
              const maxReceita = data.topClientes[0]?.receita ?? 1
              const pct = (c.receita / maxReceita) * 100
              return (
                <div key={c.clienteId} className="flex items-center gap-3">
                  <span
                    className="tabular-nums w-6 text-right"
                    style={{ color: 'var(--text-dim)', fontSize: 11 }}
                  >
                    {i + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="truncate"
                        style={{ fontSize: 13, fontWeight: 500 }}
                      >
                        {c.nome}
                      </span>
                      <span
                        className="tabular-nums shrink-0 ml-2"
                        style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}
                      >
                        {fmt(c.receita)}
                      </span>
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: 'var(--accent)',
                        }}
                      />
                    </div>
                  </div>
                  <span
                    className="tabular-nums shrink-0"
                    style={{ fontSize: 11, color: 'var(--text-dim)' }}
                  >
                    {c.count} {c.count === 1 ? 'prop.' : 'props.'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </GlassCard>
    </div>
  )
}

// ─────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────
interface KpiCardProps {
  label: string
  valor: string
  delta: number | null
  sub: string
}

function KpiCardExec({ label, valor, delta, sub }: KpiCardProps) {
  const showDelta = delta != null
  const positive = delta != null && delta > 0
  const negative = delta != null && delta < 0
  const cor = positive ? 'var(--success)' : negative ? 'var(--danger)' : 'var(--text-dim)'
  const Icon = positive ? TrendingUp : negative ? TrendingDown : Minus

  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="eyebrow" style={{ fontSize: 10 }}>
          {label}
        </span>
        {showDelta && (
          <span
            className="flex items-center gap-0.5 tabular-nums"
            style={{ fontSize: 11, color: cor, fontWeight: 600 }}
          >
            <Icon className="h-3 w-3" />
            {(delta * 100).toFixed(1)}%
          </span>
        )}
      </div>
      <p
        className="tabular-nums leading-tight"
        style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}
      >
        {valor}
      </p>
      <p className="text-fg-3 mt-1" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
        {sub}
      </p>
    </div>
  )
}

function formatMesLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-')
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const i = parseInt(m, 10) - 1
  return `${meses[i] ?? m}/${y.slice(2)}`
}
