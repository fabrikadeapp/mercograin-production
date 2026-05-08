import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import {
  PageHeader,
  DenseTable,
  Card,
  Tabs,
  SearchField,
  Button,
} from '@/components/ui/phb'
import Link from 'next/link'
import { PLANS } from '@/lib/stripe/server'
import { StatusBadge, MoneyValue, RelativeTime, PlanBadge } from '../_components/atoms'
import { Download } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface SP {
  searchParams?: {
    status?: string
    plan?: string
    q?: string
    page?: string
  }
}

const STATUS_TABS = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Ativos' },
  { id: 'trialing', label: 'Trials' },
  { id: 'past_due', label: 'Em atraso' },
  { id: 'canceled', label: 'Cancelados' },
  { id: 'none', label: 'Sem assinatura' },
] as const

const PLAN_OPTIONS = ['all', 'starter', 'pro', 'enterprise'] as const

export default async function UsuariosPage({ searchParams }: SP) {
  const status = searchParams?.status ?? 'all'
  const plan = searchParams?.plan ?? 'all'
  const q = (searchParams?.q ?? '').trim()
  const page = Math.max(1, parseInt(searchParams?.page ?? '1', 10) || 1)
  const pageSize = 25

  const where: Prisma.UserWhereInput = {}
  if (q) {
    where.OR = [
      { nome: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { clientes: { some: { cnpj: { contains: q, mode: 'insensitive' } } } },
    ]
  }
  if (status === 'none') {
    where.subscription = null
  } else if (status !== 'all') {
    where.subscription = { status }
  }
  if (plan !== 'all') {
    where.subscription = { ...(where.subscription as object), plan }
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      include: { subscription: true },
      orderBy: { criadoEm: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.user.count({ where }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

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
    return s ? `/admin/usuarios?${s}` : '/admin/usuarios'
  }

  return (
    <>
      <PageHeader
        eyebrow="ADMIN · USUÁRIOS"
        title={`${total} usuário${total !== 1 ? 's' : ''}`}
        subtitle="Gerencie todos os usuários do SaaS"
        search={false}
        showBell={false}
        actions={
          <a
            href={`/api/admin/users/export?${new URLSearchParams({ status, plan, q }).toString()}`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-bg-2 hover:bg-bg-3 border border-border-1 text-fg-1 text-small font-medium"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </a>
        }
      />

      {/* Filtros */}
      <Card className="p-4 mb-6 space-y-4">
        <form
          method="GET"
          action="/admin/usuarios"
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
          <div className="flex gap-2 ml-auto">
            <select
              name="plan"
              defaultValue={plan}
              className="px-3 py-2 bg-bg-2 border border-border-1 rounded-md text-fg-1 text-small"
            >
              {PLAN_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p === 'all'
                    ? 'Todos os planos'
                    : p[0].toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Nome, email, CNPJ…"
              className="px-3 py-2 bg-bg-2 border border-border-1 rounded-md text-fg-1 text-small w-72"
            />
            {status !== 'all' && <input type="hidden" name="status" value={status} />}
            <Button type="submit" size="sm">
              Filtrar
            </Button>
          </div>
        </form>
      </Card>

      <DenseTable
        rowKey={(u) => u.id}
        rows={users}
        columns={[
          {
            key: 'user',
            header: 'Usuário',
            accessor: (u) => (
              <Link
                href={`/admin/usuarios/${u.id}`}
                className="hover:text-accent"
              >
                <div className="font-medium text-fg-1">{u.nome}</div>
                <div className="text-fg-3 text-micro truncate max-w-[260px]">
                  {u.email}
                </div>
              </Link>
            ),
          },
          {
            key: 'plan',
            header: 'Plano',
            accessor: (u) => <PlanBadge plan={u.subscription?.plan} />,
          },
          {
            key: 'status',
            header: 'Status',
            accessor: (u) => <StatusBadge status={u.subscription?.status} />,
          },
          {
            key: 'mrr',
            header: 'MRR',
            align: 'right',
            isNumeric: true,
            accessor: (u) => {
              const cents =
                u.subscription?.status === 'active'
                  ? PLANS[u.subscription.plan as keyof typeof PLANS]?.price ?? 0
                  : 0
              return cents ? <MoneyValue cents={cents} /> : <span className="text-fg-3">—</span>
            },
          },
          {
            key: 'next',
            header: 'Trial / Próx. cobrança',
            align: 'right',
            accessor: (u) => {
              const s = u.subscription
              if (!s) return <span className="text-fg-3">—</span>
              if (s.status === 'trialing' && s.trialEnd) {
                return (
                  <span className="text-warn text-small">
                    Trial até {new Date(s.trialEnd).toLocaleDateString('pt-BR')}
                  </span>
                )
              }
              if (s.currentPeriodEnd) {
                return (
                  <span className="text-fg-2 text-small">
                    {new Date(s.currentPeriodEnd).toLocaleDateString('pt-BR')}
                  </span>
                )
              }
              return <span className="text-fg-3">—</span>
            },
          },
          {
            key: 'created',
            header: 'Cadastro',
            align: 'right',
            accessor: (u) => <RelativeTime date={u.criadoEm} />,
          },
        ]}
        empty={
          q || status !== 'all' || plan !== 'all'
            ? 'Nenhum usuário encontrado com esses filtros'
            : 'Sem usuários ainda'
        }
      />

      {/* Paginação */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between mt-4">
          <span className="text-fg-3 text-small">
            Página {page} de {totalPages} · {total} resultados
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
