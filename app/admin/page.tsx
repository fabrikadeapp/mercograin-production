import { db } from '@/lib/db'
import {
  KPICard,
  PageHeader,
  Card,
  BarChart,
  Donut,
  DenseTable,
} from '@/components/ui/phb'
import { PLANS } from '@/lib/stripe/server'
import { StatusBadge, MoneyValue, RelativeTime, PlanBadge } from './_components/atoms'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface MonthBucket {
  ym: string // 'YYYY-MM'
  label: string
  start: Date
  end: Date
}

function lastNMonths(n: number): MonthBucket[] {
  const now = new Date()
  const buckets: MonthBucket[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'short' })
    buckets.push({ ym, label, start, end })
  }
  return buckets
}

function lastNDays(n: number): { day: Date; key: string }[] {
  const out: { day: Date; key: string }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    out.push({ day: d, key: d.toISOString().slice(0, 10) })
  }
  return out
}

export default async function AdminOverview() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const last30 = new Date(Date.now() - 30 * 24 * 3600 * 1000)
  const prev30 = new Date(Date.now() - 60 * 24 * 3600 * 1000)

  // ----- MRR (active subscriptions × plan price) -----
  const [activeSubs, allSubsForChart] = await Promise.all([
    db.subscription.findMany({ where: { status: 'active' }, select: { plan: true } }),
    db.subscription.findMany({
      select: {
        id: true,
        plan: true,
        status: true,
        createdAt: true,
        canceledAt: true,
      },
    }),
  ])

  const mrrCents = activeSubs.reduce((acc, s) => {
    const cfg = PLANS[s.plan as keyof typeof PLANS]
    return acc + (cfg?.price ?? 0)
  }, 0)

  // MRR previous month (subs that were active before start of current month)
  const prevActiveSubs = allSubsForChart.filter(
    (s) =>
      s.createdAt < startOfMonth &&
      (s.status === 'active' || s.status === 'past_due') &&
      (!s.canceledAt || s.canceledAt >= startOfMonth),
  )
  const mrrPrevCents = prevActiveSubs.reduce((acc, s) => {
    const cfg = PLANS[s.plan as keyof typeof PLANS]
    return acc + (cfg?.price ?? 0)
  }, 0)

  const mrrDelta = mrrPrevCents
    ? ((mrrCents - mrrPrevCents) / mrrPrevCents) * 100
    : 0

  // MRR sparkline: 6 months
  const months6 = lastNMonths(6)
  const mrrSparkline = months6.map((m) => {
    const subs = allSubsForChart.filter(
      (s) =>
        s.createdAt < m.end &&
        (s.status === 'active' ||
          s.status === 'past_due' ||
          (s.canceledAt && s.canceledAt >= m.end)),
    )
    return (
      subs.reduce(
        (acc, s) => acc + (PLANS[s.plan as keyof typeof PLANS]?.price ?? 0),
        0,
      ) / 100
    )
  })

  // ----- Active users (active or trialing subscription) -----
  const activeUsers = await db.user.count({
    where: {
      subscription: { status: { in: ['active', 'trialing'] } },
    },
  })

  // Sparkline 30d: count of users with sub active by day (cumulative proxy)
  const days30 = lastNDays(30)
  const userActiveSparkline = days30.map((d) => {
    const dayEnd = new Date(d.day)
    dayEnd.setDate(dayEnd.getDate() + 1)
    return allSubsForChart.filter(
      (s) =>
        s.createdAt < dayEnd &&
        (s.status === 'active' ||
          s.status === 'trialing' ||
          (s.canceledAt && s.canceledAt >= dayEnd)),
    ).length
  })

  // ----- Trials -----
  const trialing = await db.subscription.count({ where: { status: 'trialing' } })
  const trialSparkline = days30.map((d) => {
    const dayEnd = new Date(d.day)
    dayEnd.setDate(dayEnd.getDate() + 1)
    return allSubsForChart.filter(
      (s) =>
        s.status === 'trialing' &&
        s.createdAt < dayEnd,
    ).length
  })

  // ----- Churn rate 30d -----
  const canceledLast30 = allSubsForChart.filter(
    (s) => s.canceledAt && s.canceledAt >= last30,
  ).length
  const activeAt30dAgo = allSubsForChart.filter(
    (s) =>
      s.createdAt < last30 &&
      (s.status === 'active' ||
        s.status === 'past_due' ||
        (s.canceledAt && s.canceledAt >= last30)),
  ).length
  const churnRate = activeAt30dAgo
    ? (canceledLast30 / activeAt30dAgo) * 100
    : 0

  const canceledPrev30 = allSubsForChart.filter(
    (s) => s.canceledAt && s.canceledAt >= prev30 && s.canceledAt < last30,
  ).length
  const activeAt60d = allSubsForChart.filter(
    (s) =>
      s.createdAt < prev30 &&
      (s.status === 'active' ||
        s.status === 'past_due' ||
        (s.canceledAt && s.canceledAt >= prev30)),
  ).length
  const churnRatePrev = activeAt60d ? (canceledPrev30 / activeAt60d) * 100 : 0
  const churnDelta = churnRate - churnRatePrev

  // ----- Receita por mês (12 meses) -----
  const months12 = lastNMonths(12)
  const revenueByMonth = months12.map((m) => {
    // sum dos planos das subs que estiveram active dentro do mês
    const subsInMonth = allSubsForChart.filter(
      (s) =>
        s.createdAt < m.end &&
        (s.status === 'active' ||
          (s.canceledAt && s.canceledAt >= m.start) ||
          s.status === 'past_due'),
    )
    return {
      label: m.label,
      value:
        subsInMonth.reduce(
          (acc, s) =>
            acc + (PLANS[s.plan as keyof typeof PLANS]?.price ?? 0),
          0,
        ) / 100,
    }
  })

  // ----- Funil de conversão -----
  const totalUsers = await db.user.count()
  const usersTrialing = await db.user.count({
    where: { subscription: { status: 'trialing' } },
  })
  const usersPaying = await db.user.count({
    where: { subscription: { status: 'active' } },
  })

  const funnelData = [
    { label: 'Signups', value: totalUsers, color: 'var(--fg-3)' },
    { label: 'Trial', value: usersTrialing, color: 'var(--warn)' },
    { label: 'Pagantes', value: usersPaying, color: 'var(--accent)' },
  ]

  // ----- Últimos 10 signups -----
  const signups = await db.user.findMany({
    orderBy: { criadoEm: 'desc' },
    take: 10,
    include: { subscription: true },
  })

  // ----- Últimas 10 transações Stripe (via WebhookLog tipo='stripe' ou 'braspag') -----
  const transactions = await db.webhookLog.findMany({
    where: { tipo: { in: ['stripe', 'braspag'] } },
    orderBy: { criadoEm: 'desc' },
    take: 10,
  })

  return (
    <>
      <PageHeader
        eyebrow="ADMIN · OVERVIEW"
        title="Painel SuperAdmin"
        subtitle="Visão geral do SaaS · MRR, usuários, conteúdo e infraestrutura"
        search={false}
        showBell={false}
      />

      {/* Linha 1: 4 KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KPICard
          eyebrow="MRR"
          value={new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(mrrCents / 100)}
          subtitle={`vs mês ant: ${mrrPrevCents ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mrrPrevCents / 100) : '—'}`}
          delta={
            mrrPrevCents
              ? {
                  value: `${mrrDelta >= 0 ? '+' : ''}${mrrDelta.toFixed(1)}%`,
                  trend:
                    mrrDelta > 0 ? 'pos' : mrrDelta < 0 ? 'neg' : 'neutral',
                }
              : undefined
          }
          sparklineData={mrrSparkline}
          highlightValue
        />
        <KPICard
          eyebrow="Usuários ativos"
          value={String(activeUsers)}
          subtitle="Com assinatura ativa ou em trial"
          sparklineData={userActiveSparkline}
        />
        <KPICard
          eyebrow="Trials ativos"
          value={String(trialing)}
          subtitle="Subscriptions status=trialing"
          sparklineData={trialSparkline}
          sparklineColor="var(--warn)"
        />
        <KPICard
          eyebrow="Churn (30d)"
          value={`${churnRate.toFixed(1)}%`}
          subtitle={`${canceledLast30} cancelamentos / ${activeAt30dAgo} base`}
          delta={
            activeAt60d
              ? {
                  value: `${churnDelta >= 0 ? '+' : ''}${churnDelta.toFixed(1)}pp`,
                  trend:
                    churnDelta < 0
                      ? 'pos'
                      : churnDelta > 0
                        ? 'neg'
                        : 'neutral',
                }
              : undefined
          }
        />
      </div>

      {/* Linha 2: 2 charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="eyebrow">Receita</p>
              <h3 className="text-fg-1 text-h3 font-semibold">
                Receita por mês · últimos 12 meses
              </h3>
            </div>
          </div>
          <BarChart data={revenueByMonth} height={220} />
        </Card>
        <Card className="p-5">
          <div className="mb-4">
            <p className="eyebrow">Conversão</p>
            <h3 className="text-fg-1 text-h3 font-semibold">Funil</h3>
          </div>
          <Donut
            data={funnelData}
            centerLabel="Total"
            centerValue={String(totalUsers)}
          />
          <div className="mt-4 space-y-2">
            {funnelData.map((d) => (
              <div
                key={d.label}
                className="flex items-center justify-between text-small"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: d.color }}
                  />
                  <span className="text-fg-2">{d.label}</span>
                </span>
                <span className="text-fg-1 font-mono tabular-nums">
                  {d.value}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Linha 3: 2 tabelas */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-fg-1 text-h3 font-semibold">
              Últimos 10 signups
            </h3>
            <Link
              href="/admin/usuarios"
              className="text-accent text-small hover:underline"
            >
              Ver todos →
            </Link>
          </div>
          <DenseTable
            rowKey={(r) => r.id}
            rows={signups}
            columns={[
              {
                key: 'user',
                header: 'Usuário',
                accessor: (r) => (
                  <Link
                    href={`/admin/usuarios/${r.id}`}
                    className="hover:text-accent"
                  >
                    <div className="font-medium text-fg-1">{r.nome}</div>
                    <div className="text-fg-3 text-micro truncate max-w-[200px]">
                      {r.email}
                    </div>
                  </Link>
                ),
              },
              {
                key: 'plan',
                header: 'Plano',
                accessor: (r) => <PlanBadge plan={r.subscription?.plan} />,
              },
              {
                key: 'status',
                header: 'Status',
                accessor: (r) => (
                  <StatusBadge status={r.subscription?.status} />
                ),
              },
              {
                key: 'date',
                header: 'Cadastro',
                accessor: (r) => <RelativeTime date={r.criadoEm} />,
                align: 'right',
              },
            ]}
            empty="Nenhum signup ainda"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-fg-1 text-h3 font-semibold">
              Últimas 10 transações
            </h3>
            <Link
              href="/admin/operacional/webhooks"
              className="text-accent text-small hover:underline"
            >
              Ver webhooks →
            </Link>
          </div>
          <DenseTable
            rowKey={(r) => r.id}
            rows={transactions}
            columns={[
              {
                key: 'type',
                header: 'Tipo',
                accessor: (r) => (
                  <span className="font-mono text-micro uppercase tracking-wider text-fg-2">
                    {r.tipo}
                  </span>
                ),
              },
              {
                key: 'event',
                header: 'Evento',
                accessor: (r) => {
                  const event =
                    (r.payload as any)?.type ??
                    (r.payload as any)?.event ??
                    '—'
                  return (
                    <span className="text-fg-1 text-small truncate block max-w-[220px]">
                      {String(event)}
                    </span>
                  )
                },
              },
              {
                key: 'status',
                header: 'Status',
                accessor: (r) => (
                  <StatusBadge
                    status={
                      r.status === 'processado'
                        ? 'active'
                        : r.status === 'erro'
                          ? 'past_due'
                          : 'trialing'
                    }
                  />
                ),
              },
              {
                key: 'date',
                header: 'Quando',
                accessor: (r) => <RelativeTime date={r.criadoEm} />,
                align: 'right',
              },
            ]}
            empty="Nenhuma transação registrada"
          />
        </div>
      </div>
    </>
  )
}
