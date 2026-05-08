import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { PageHeader, DenseTable, Card, Button } from '@/components/ui/phb'
import Link from 'next/link'
import { loadPlanMaps } from '@/lib/pricing/maps'
import {
  StatusBadge,
  MoneyValue,
  RelativeTime,
  PlanBadge,
} from '../_components/atoms'

export const dynamic = 'force-dynamic'

const STATUS_TABS = [
  { id: 'all', label: 'Todas' },
  { id: 'active', label: 'Ativas' },
  { id: 'trialing', label: 'Trials' },
  { id: 'past_due', label: 'Em atraso' },
  { id: 'canceled', label: 'Canceladas' },
] as const

export default async function AssinaturasPage({
  searchParams,
}: {
  searchParams?: { status?: string; plan?: string; q?: string; page?: string }
}) {
  const status = searchParams?.status ?? 'all'
  const plan = searchParams?.plan ?? 'all'
  const q = (searchParams?.q ?? '').trim()
  const page = Math.max(1, parseInt(searchParams?.page ?? '1', 10) || 1)
  const pageSize = 30

  const where: Prisma.SubscriptionWhereInput = {}
  if (status !== 'all') where.status = status
  if (plan !== 'all') where.plan = plan
  if (q) {
    where.OR = [
      { stripeCustomerId: { contains: q } },
      { stripeSubscriptionId: { contains: q } },
      { workspace: { owner: { email: { contains: q, mode: 'insensitive' } } } },
    ]
  }

  const [
    subs,
    total,
    statsActive,
    statsTrialing,
    statsPastDue,
    statsCanceled,
    maps,
  ] = await Promise.all([
    db.subscription.findMany({
      where,
      include: {
        workspace: {
          include: {
            owner: { select: { id: true, nome: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.subscription.count({ where }),
    db.subscription.count({ where: { status: 'active' } }),
    db.subscription.count({ where: { status: 'trialing' } }),
    db.subscription.count({ where: { status: 'past_due' } }),
    db.subscription.count({ where: { status: 'canceled' } }),
    loadPlanMaps(),
  ])

  function buildHref(p: { status?: string; plan?: string; q?: string; page?: number }) {
    const sp = new URLSearchParams()
    const ns = p.status ?? status
    const np = p.plan ?? plan
    const nq = p.q ?? q
    const npg = p.page ?? page
    if (ns !== 'all') sp.set('status', ns)
    if (np !== 'all') sp.set('plan', np)
    if (nq) sp.set('q', nq)
    if (npg > 1) sp.set('page', String(npg))
    const s = sp.toString()
    return s ? `/admin/assinaturas?${s}` : '/admin/assinaturas'
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <>
      <PageHeader
        eyebrow="ADMIN · ASSINATURAS"
        title={`${total} assinatura${total !== 1 ? 's' : ''}`}
        subtitle="Visão geral de subscriptions Stripe"
        search={false}
        showBell={false}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatBox label="Ativas" value={statsActive} color="var(--pos)" />
        <StatBox label="Trials" value={statsTrialing} color="var(--warn)" />
        <StatBox label="Em atraso" value={statsPastDue} color="var(--neg)" />
        <StatBox label="Canceladas" value={statsCanceled} color="var(--fg-3)" />
      </div>

      <Card className="p-4 mb-6">
        <form
          method="GET"
          action="/admin/assinaturas"
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex flex-wrap gap-1">
            {STATUS_TABS.map((t) => {
              const active = status === t.id
              return (
                <Link
                  key={t.id}
                  href={buildHref({ status: t.id, page: 1 })}
                  className={`px-3 py-1.5 rounded-pill text-small font-medium border transition ${
                    active
                      ? 'bg-accent text-[var(--accent-ink)] border-transparent'
                      : 'bg-bg-2 text-fg-2 border-border-1 hover:bg-bg-3'
                  }`}
                >
                  {t.label}
                </Link>
              )
            })}
          </div>
          <div className="ml-auto flex gap-2">
            <select
              name="plan"
              defaultValue={plan}
              className="px-3 py-2 bg-bg-2 border border-border-1 rounded-md text-fg-1 text-small"
            >
              <option value="all">Todos planos</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Email, customer ID, sub ID…"
              className="px-3 py-2 bg-bg-2 border border-border-1 rounded-md text-fg-1 text-small w-72"
            />
            {status !== 'all' && (
              <input type="hidden" name="status" value={status} />
            )}
            <Button type="submit" size="sm">
              Filtrar
            </Button>
          </div>
        </form>
      </Card>

      <DenseTable
        rowKey={(s) => s.id}
        rows={subs}
        columns={[
          {
            key: 'customer',
            header: 'Customer',
            accessor: (s) => (
              <Link
                href={`/admin/usuarios/${s.workspace?.owner.id}`}
                className="hover:text-accent"
              >
                <div className="text-fg-1 font-medium">{s.workspace?.owner.nome}</div>
                <div className="text-fg-3 text-micro truncate max-w-[260px]">
                  {s.workspace?.owner.email}
                </div>
              </Link>
            ),
          },
          {
            key: 'plan',
            header: 'Plano',
            accessor: (s) => <PlanBadge plan={s.plan} />,
          },
          {
            key: 'mrr',
            header: 'MRR',
            align: 'right',
            isNumeric: true,
            accessor: (s) => (
              <MoneyValue
                cents={
                  s.status === 'active'
                    ? maps.priceCents[s.plan] ?? 0
                    : 0
                }
              />
            ),
          },
          {
            key: 'status',
            header: 'Status',
            accessor: (s) => <StatusBadge status={s.status} />,
          },
          {
            key: 'trial',
            header: 'Trial fim',
            align: 'right',
            accessor: (s) =>
              s.trialEnd ? (
                <span className="text-fg-2 text-small">
                  {new Date(s.trialEnd).toLocaleDateString('pt-BR')}
                </span>
              ) : (
                <span className="text-fg-3">—</span>
              ),
          },
          {
            key: 'period',
            header: 'Próx. ciclo',
            align: 'right',
            accessor: (s) =>
              s.currentPeriodEnd ? (
                <span className="text-fg-2 text-small">
                  {new Date(s.currentPeriodEnd).toLocaleDateString('pt-BR')}
                </span>
              ) : (
                <span className="text-fg-3">—</span>
              ),
          },
          {
            key: 'created',
            header: 'Criada',
            align: 'right',
            accessor: (s) => <RelativeTime date={s.createdAt} />,
          },
        ]}
        empty="Nenhuma assinatura encontrada"
      />

      {totalPages > 1 ? (
        <div className="flex items-center justify-between mt-4">
          <span className="text-fg-3 text-small">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={buildHref({ page: page - 1 })}
                className="px-3 py-1.5 rounded-md bg-bg-2 border border-border-1 text-fg-1 text-small hover:bg-bg-3"
              >
                ← Anterior
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={buildHref({ page: page + 1 })}
                className="px-3 py-1.5 rounded-md bg-bg-2 border border-border-1 text-fg-1 text-small hover:bg-bg-3"
              >
                Próxima →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="bg-bg-2 border border-border-1 rounded-md p-4 flex items-center justify-between">
      <div>
        <p className="eyebrow">{label}</p>
        <p className="t-num-lg text-fg-1">{value}</p>
      </div>
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: color }}
        aria-hidden="true"
      />
    </div>
  )
}
