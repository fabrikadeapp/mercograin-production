'use client'
import * as React from 'react'
import {
  PageHeader,
  Card,
  KPICard,
  BarChart,
  Button,
  Chip,
} from '@/components/ui/phb'
import { RefreshCw } from 'lucide-react'
import type { DashboardMetrics } from '@/lib/admin/metrics'
import {
  PlanBadge,
  StatusBadge,
  RelativeTime,
} from '../../_components/atoms'

interface Props {
  initialMetrics: DashboardMetrics
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatBRLCompact(value: number): string {
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(1).replace('.', ',')}M`
  }
  if (value >= 10_000) {
    return `R$ ${Math.round(value / 1000)}k`
  }
  return formatBRL(value)
}

function formatPct(v: number): string {
  return `${v.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`
}

export function MetricasContent({ initialMetrics }: Props) {
  const [metrics, setMetrics] = React.useState<DashboardMetrics>(initialMetrics)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleRefresh = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/metrics', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as DashboardMetrics
      setMetrics(data)
    } catch (e) {
      setError(
        e instanceof Error
          ? `Falha ao atualizar: ${e.message}`
          : 'Falha ao atualizar',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  // Trend MRR atual vs mês anterior
  const trend = metrics.mrrTrend
  const mrrPrev = trend.length >= 2 ? trend[trend.length - 2].value : 0
  const mrrDeltaPct =
    mrrPrev > 0 ? ((metrics.mrr - mrrPrev) / mrrPrev) * 100 : 0
  const mrrDelta =
    mrrPrev > 0
      ? {
          value: `${mrrDeltaPct >= 0 ? '+' : ''}${mrrDeltaPct.toFixed(1)}%`,
          trend: (mrrDeltaPct >= 0 ? 'pos' : 'neg') as 'pos' | 'neg',
        }
      : undefined

  const ativosTotal =
    metrics.workspacesAtivos +
    metrics.workspacesTrial +
    metrics.workspacesPaused
  const ativosPctTotal =
    metrics.totalWorkspaces > 0
      ? Math.round((metrics.workspacesAtivos / metrics.totalWorkspaces) * 100)
      : 0

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Super Admin"
        title="Métricas"
        subtitle={`Snapshot operacional e financeiro · gerado ${new Date(
          metrics.geradoEm,
        ).toLocaleString('pt-BR')}`}
        search={false}
        showBell={false}
        actions={
          <Button
            variant="ghost"
            onClick={handleRefresh}
            disabled={loading}
            aria-label="Atualizar métricas"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
            />
            Atualizar
          </Button>
        }
      />

      {error ? (
        <Card className="p-4 border-l-4" style={{ borderLeftColor: 'var(--neg)' }}>
          <p className="text-small text-fg-2">{error}</p>
        </Card>
      ) : null}

      {/* ============ Seção 1: KPIs ============ */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          eyebrow="MRR"
          value={formatBRLCompact(metrics.mrr)}
          subtitle={`${metrics.workspacesAtivos} workspaces pagantes`}
          delta={mrrDelta}
          sparklineData={trend.map((t) => t.value)}
          highlightValue
        />
        <KPICard
          eyebrow="Workspaces ativos"
          value={`${metrics.workspacesAtivos}`}
          subtitle={`de ${metrics.totalWorkspaces} (${ativosPctTotal}%)`}
        />
        <KPICard
          eyebrow="Signups · 30d"
          value={`${metrics.signupsUltimos30d}`}
          subtitle="novos usuários cadastrados"
        />
        <KPICard
          eyebrow="Conversão trial → paid"
          value={formatPct(metrics.trialParaPagoConversao)}
          subtitle={`${metrics.trialConvertidos90d}/${metrics.trialIniciados90d} nos últimos 90d`}
        />
      </section>

      {/* ============ Seção 1b: Hedge & Risco (Enterprise tier) ============ */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          eyebrow="Volume hedge ativo"
          value={`US$ ${Math.round(metrics.volumeHedgeAtivoUSD).toLocaleString('pt-BR')}`}
          subtitle="notional total · posições abertas"
          highlightValue
        />
        <KPICard
          eyebrow="Exposição cambial mediana"
          value={`US$ ${Math.round(metrics.exposicaoCambialMedianaUSD).toLocaleString('pt-BR')}`}
          subtitle="por workspace · valor mediano"
        />
      </section>

      {/* ============ Seção 2: MRR Trend + Distribuição por Plano ============ */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Histórico</p>
              <h3 className="text-h3 font-sans tracking-tight text-fg-1">
                MRR — últimos 6 meses
              </h3>
            </div>
            <Chip variant="neutral">snapshot</Chip>
          </div>
          {trend.length > 0 ? (
            <BarChart
              data={trend.map((t) => ({ label: t.label, value: t.value }))}
              highlightLast
              height={220}
            />
          ) : (
            <p className="text-fg-3 text-small">Sem dados ainda.</p>
          )}
        </Card>

        <Card className="p-5 space-y-4">
          <div>
            <p className="eyebrow">Receita</p>
            <h3 className="text-h3 font-sans tracking-tight text-fg-1">
              Distribuição por plano
            </h3>
          </div>
          {metrics.porPlano.length === 0 ? (
            <p className="text-fg-3 text-small">Sem assinaturas ativas.</p>
          ) : (
            <ul className="space-y-3">
              {metrics.porPlano.map((p) => (
                <li
                  key={p.plan}
                  className="flex items-center justify-between gap-3 pb-3 border-b border-border-1 last:border-0 last:pb-0"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <PlanBadge plan={p.plan} />
                    <span className="text-small text-fg-2">
                      {p.count} ws
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-fg-1 font-mono tabular-nums text-small">
                      {formatBRLCompact(p.mrr)}
                    </div>
                    <div className="text-fg-3 text-micro">
                      {formatPct(p.pctMrr)} do MRR
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* ============ Seção 3: Engagement & Churn ============ */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 space-y-3">
          <p className="eyebrow">Engajamento</p>
          <h3 className="text-h3 font-sans tracking-tight text-fg-1">
            Atividade real — últimos 7d
          </h3>
          <div className="flex items-baseline gap-3">
            <span className="t-num-lg text-accent">
              {metrics.workspacesAtivosUltimos7d}
            </span>
            <span className="text-fg-3 text-small">
              workspaces criaram propostas, contratos ou boletos
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border-1">
            <div>
              <p className="text-fg-3 text-micro uppercase tracking-wider">
                Trial
              </p>
              <p className="text-fg-1 t-num">{metrics.workspacesTrial}</p>
            </div>
            <div>
              <p className="text-fg-3 text-micro uppercase tracking-wider">
                Pausados
              </p>
              <p className="text-fg-1 t-num">{metrics.workspacesPaused}</p>
            </div>
            <div>
              <p className="text-fg-3 text-micro uppercase tracking-wider">
                Sem assin.
              </p>
              <p className="text-fg-1 t-num">
                {metrics.workspacesSemAssinatura}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <p className="eyebrow">Saúde</p>
          <h3 className="text-h3 font-sans tracking-tight text-fg-1">
            Churn — últimos 30d
          </h3>
          <div className="flex items-baseline gap-3">
            <span
              className="t-num-lg"
              style={{
                color:
                  metrics.churnUltimo30d > 0 ? 'var(--neg)' : 'var(--fg-1)',
              }}
            >
              {metrics.churnUltimo30d}
            </span>
            <span className="text-fg-3 text-small">
              workspaces cancelados / inadimplentes
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border-1">
            <div>
              <p className="text-fg-3 text-micro uppercase tracking-wider">
                Total workspaces
              </p>
              <p className="text-fg-1 t-num">{metrics.totalWorkspaces}</p>
            </div>
            <div>
              <p className="text-fg-3 text-micro uppercase tracking-wider">
                Com assinatura
              </p>
              <p className="text-fg-1 t-num">{ativosTotal}</p>
            </div>
          </div>
        </Card>
      </section>

      {/* ============ Seção 4: Top 10 workspaces ============ */}
      <section>
        <Card className="p-5 space-y-4">
          <div>
            <p className="eyebrow">Uso · 30d</p>
            <h3 className="text-h3 font-sans tracking-tight text-fg-1">
              Top 10 workspaces por atividade
            </h3>
          </div>
          {metrics.topWorkspaces.length === 0 ? (
            <p className="text-fg-3 text-small">
              Nenhum workspace com atividade nos últimos 30 dias.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead>
                  <tr className="text-left text-fg-3 text-micro uppercase tracking-wider border-b border-border-1">
                    <th className="py-2 pr-3 font-medium">Workspace</th>
                    <th className="py-2 pr-3 font-medium">Plano</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium text-right">
                      Propostas/30d
                    </th>
                    <th className="py-2 pr-3 font-medium text-right">
                      Contratos/30d
                    </th>
                    <th className="py-2 pr-3 font-medium text-right">
                      Membros
                    </th>
                    <th className="py-2 font-medium">Criado</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.topWorkspaces.map((w) => (
                    <tr
                      key={w.id}
                      className="border-b border-border-1 last:border-0 hover:bg-bg-2/50 transition-colors"
                    >
                      <td className="py-2.5 pr-3 text-fg-1 font-medium truncate max-w-xs">
                        {w.name}
                      </td>
                      <td className="py-2.5 pr-3">
                        <PlanBadge plan={w.plano} />
                      </td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge status={w.status} />
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-fg-1">
                        {w.propostas30d}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-fg-1">
                        {w.contratos30d}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-fg-1">
                        {w.membros}
                      </td>
                      <td className="py-2.5">
                        <RelativeTime date={w.criadoEm} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  )
}
