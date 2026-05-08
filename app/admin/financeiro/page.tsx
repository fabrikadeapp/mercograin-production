import { db } from '@/lib/db'
import { loadPlanMaps } from '@/lib/pricing/maps'
import {
  PageHeader,
  KPICard,
  Card,
  BarChart,
  DenseTable,
} from '@/components/ui/phb'
import { MoneyValue } from '../_components/atoms'

export const dynamic = 'force-dynamic'

interface MonthBucket {
  ym: string
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
    buckets.push({
      ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('pt-BR', {
        month: 'short',
        year: '2-digit',
      }),
      start,
      end,
    })
  }
  return buckets
}

export default async function FinanceiroPage() {
  const [subs, activeUsers, recentTransactions, maps] = await Promise.all([
    db.subscription.findMany({
      select: {
        plan: true,
        status: true,
        createdAt: true,
        canceledAt: true,
        workspace: { select: { owner: { select: { email: true } } } },
      },
    }),
    db.user.count({
      where: {
        workspacesOwned: {
          some: { subscription: { status: { in: ['active', 'trialing'] } } },
        },
      },
    }),
    db.webhookLog.findMany({
      where: { tipo: 'stripe' },
      orderBy: { criadoEm: 'desc' },
      take: 25,
    }),
    loadPlanMaps(),
  ])

  const mrrCents = subs
    .filter((s) => s.status === 'active')
    .reduce(
      (acc, s) => acc + (maps.priceCents[s.plan] ?? 0),
      0,
    )
  const arrCents = mrrCents * 12
  const arpuCents = activeUsers ? Math.round(mrrCents / activeUsers) : 0

  // Churn 30d
  const last30 = new Date(Date.now() - 30 * 24 * 3600 * 1000)
  const canceled30 = subs.filter(
    (s) => s.canceledAt && s.canceledAt >= last30,
  ).length
  const baseAt30dAgo = subs.filter(
    (s) =>
      s.createdAt < last30 &&
      (s.status === 'active' ||
        (s.canceledAt && s.canceledAt >= last30) ||
        s.status === 'past_due'),
  ).length
  const churnRate = baseAt30dAgo ? canceled30 / baseAt30dAgo : 0
  const ltvCents =
    churnRate > 0 ? Math.round(arpuCents / churnRate) : arpuCents * 24

  // 24-month series
  const months = lastNMonths(24)
  const mrrSeries = months.map((m) => {
    const subsInMonth = subs.filter(
      (s) =>
        s.createdAt < m.end &&
        (s.status === 'active' ||
          (s.canceledAt && s.canceledAt >= m.start)),
    )
    return {
      label: m.label,
      value:
        subsInMonth.reduce(
          (acc, s) =>
            acc + (maps.priceCents[s.plan] ?? 0),
          0,
        ) / 100,
    }
  })

  // Net New MRR
  const netNewSeries = months.map((m) => {
    const newSubs = subs.filter(
      (s) => s.createdAt >= m.start && s.createdAt < m.end,
    )
    const churned = subs.filter(
      (s) =>
        s.canceledAt && s.canceledAt >= m.start && s.canceledAt < m.end,
    )
    const newCents = newSubs.reduce(
      (acc, s) => acc + (maps.priceCents[s.plan] ?? 0),
      0,
    )
    const churnCents = churned.reduce(
      (acc, s) => acc + (maps.priceCents[s.plan] ?? 0),
      0,
    )
    return {
      label: m.label,
      value: (newCents - churnCents) / 100,
    }
  })

  // Por plano
  const byPlan = maps.slugs.map((p) => {
    const count = subs.filter((s) => s.plan === p && s.status === 'active')
      .length
    const planPrice = maps.priceCents[p] ?? 0
    return {
      plan: p,
      label: maps.label[p] ?? p,
      count,
      mrrCents: count * planPrice,
      pct: mrrCents ? ((count * planPrice) / mrrCents) * 100 : 0,
    }
  })

  return (
    <>
      <PageHeader
        eyebrow="ADMIN · FINANCEIRO"
        title="Financeiro"
        subtitle="MRR · ARR · LTV · ARPU · cohort"
        search={false}
        showBell={false}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KPICard
          eyebrow="MRR"
          value={new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(mrrCents / 100)}
          subtitle="Receita recorrente mensal"
          highlightValue
        />
        <KPICard
          eyebrow="ARR"
          value={new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(arrCents / 100)}
          subtitle="MRR × 12"
        />
        <KPICard
          eyebrow="ARPU"
          value={new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(arpuCents / 100)}
          subtitle={`MRR / ${activeUsers} usuários`}
        />
        <KPICard
          eyebrow="LTV"
          value={new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(ltvCents / 100)}
          subtitle={`Churn ${(churnRate * 100).toFixed(2)}%`}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <div className="mb-4">
            <p className="eyebrow">MRR mensal</p>
            <h3 className="text-fg-1 text-h3 font-semibold">
              Últimos 24 meses
            </h3>
          </div>
          <BarChart data={mrrSeries} height={220} />
        </Card>
        <Card className="p-5">
          <div className="mb-4">
            <p className="eyebrow">Net New MRR</p>
            <h3 className="text-fg-1 text-h3 font-semibold">
              Novo - churn (R$)
            </h3>
          </div>
          <BarChart data={netNewSeries} height={220} />
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <h3 className="text-fg-1 text-h3 font-semibold mb-4">
            Receita por plano
          </h3>
          <DenseTable
            rowKey={(p) => p.plan}
            rows={byPlan}
            columns={[
              {
                key: 'plan',
                header: 'Plano',
                accessor: (p) => (
                  <span className="text-fg-1 font-medium">{p.label}</span>
                ),
              },
              {
                key: 'count',
                header: 'Subs',
                align: 'right',
                isNumeric: true,
                accessor: (p) => String(p.count),
              },
              {
                key: 'mrr',
                header: 'MRR',
                align: 'right',
                isNumeric: true,
                accessor: (p) => <MoneyValue cents={p.mrrCents} />,
              },
              {
                key: 'pct',
                header: '%',
                align: 'right',
                accessor: (p) => `${p.pct.toFixed(1)}%`,
              },
            ]}
          />
        </Card>
        <Card className="p-5">
          <h3 className="text-fg-1 text-h3 font-semibold mb-4">
            Eventos Stripe recentes
          </h3>
          <DenseTable
            rowKey={(t) => t.id}
            rows={recentTransactions}
            columns={[
              {
                key: 'type',
                header: 'Evento',
                accessor: (r) => (
                  <span className="text-fg-1 text-small font-mono truncate block max-w-[260px]">
                    {String(
                      (r.payload as any)?.type ??
                        (r.payload as any)?.event ??
                        '—',
                    )}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                accessor: (r) => (
                  <span
                    className="text-micro uppercase font-semibold"
                    style={{
                      color:
                        r.status === 'erro'
                          ? 'var(--neg)'
                          : r.status === 'processado'
                            ? 'var(--pos)'
                            : 'var(--warn)',
                    }}
                  >
                    {r.status}
                  </span>
                ),
              },
              {
                key: 'date',
                header: 'Quando',
                align: 'right',
                accessor: (r) =>
                  new Date(r.criadoEm).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
              },
            ]}
            empty="Sem eventos Stripe"
          />
        </Card>
      </div>
    </>
  )
}
