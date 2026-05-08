import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { PageHeader, DenseTable, Card, Button } from '@/components/ui/phb'
import Link from 'next/link'
import { RelativeTime } from '../../_components/atoms'

export const dynamic = 'force-dynamic'

export default async function AuditoriaAdmin({
  searchParams,
}: {
  searchParams?: {
    user?: string
    action?: string
    resource?: string
    from?: string
    to?: string
  }
}) {
  const userId = searchParams?.user
  const acao = searchParams?.action
  const entidade = searchParams?.resource
  const from = searchParams?.from
  const to = searchParams?.to

  const where: Prisma.AuditLogWhereInput = {}
  if (userId) where.userId = userId
  if (acao) where.acao = acao
  if (entidade) where.entidade = entidade
  if (from || to) {
    where.criadoEm = {}
    if (from) where.criadoEm.gte = new Date(from)
    if (to) where.criadoEm.lte = new Date(to)
  }

  const logs = await db.auditLog.findMany({
    where,
    orderBy: { criadoEm: 'desc' },
    take: 200,
  })
  const userIds = [...new Set(logs.map((l) => l.userId))]
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, nome: true, email: true },
  })
  const userMap = new Map(users.map((u) => [u.id, u]))

  const navTabs = [
    { href: '/admin/operacional/cotacoes', label: 'Cotações' },
    { href: '/admin/operacional/webhooks', label: 'Webhooks' },
    {
      href: '/admin/operacional/auditoria',
      label: 'Auditoria',
      active: true,
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="ADMIN · OPERACIONAL"
        title="Auditoria"
        subtitle="Audit log completo cross-user · últimos 200 eventos"
        search={false}
        showBell={false}
        actions={
          <div className="flex gap-2">
            {navTabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`px-3 py-2 rounded-md border text-small ${
                  t.active
                    ? 'bg-bg-2 border-border-1 text-fg-1'
                    : 'bg-bg-2 border-border-1 text-fg-3 hover:text-fg-1'
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>
        }
      />

      <Card className="p-4 mb-6">
        <form
          method="GET"
          action="/admin/operacional/auditoria"
          className="flex flex-wrap items-end gap-3"
        >
          <input
            type="text"
            name="action"
            defaultValue={acao ?? ''}
            placeholder="Ação (ex: criar)"
            className="px-3 py-2 bg-bg-2 border border-border-1 rounded-md text-fg-1 text-small"
          />
          <input
            type="text"
            name="resource"
            defaultValue={entidade ?? ''}
            placeholder="Recurso (ex: cliente)"
            className="px-3 py-2 bg-bg-2 border border-border-1 rounded-md text-fg-1 text-small"
          />
          <input
            type="text"
            name="user"
            defaultValue={userId ?? ''}
            placeholder="User ID"
            className="px-3 py-2 bg-bg-2 border border-border-1 rounded-md text-fg-1 text-small font-mono"
          />
          <input
            type="date"
            name="from"
            defaultValue={from ?? ''}
            className="px-3 py-2 bg-bg-2 border border-border-1 rounded-md text-fg-1 text-small"
          />
          <input
            type="date"
            name="to"
            defaultValue={to ?? ''}
            className="px-3 py-2 bg-bg-2 border border-border-1 rounded-md text-fg-1 text-small"
          />
          <Button type="submit" size="sm">
            Filtrar
          </Button>
        </form>
      </Card>

      <DenseTable
        rowKey={(l) => l.id}
        rows={logs}
        columns={[
          {
            key: 'user',
            header: 'Usuário',
            accessor: (l) => {
              const u = userMap.get(l.userId)
              return u ? (
                <Link
                  href={`/admin/usuarios/${u.id}`}
                  className="hover:text-accent text-small"
                >
                  {u.nome}
                </Link>
              ) : (
                <span className="font-mono text-micro text-fg-3">
                  {l.userId.slice(0, 8)}…
                </span>
              )
            },
          },
          {
            key: 'acao',
            header: 'Ação',
            accessor: (l) => (
              <span className="font-mono text-micro uppercase tracking-wider text-fg-2">
                {l.acao}
              </span>
            ),
          },
          {
            key: 'entidade',
            header: 'Recurso',
            accessor: (l) => (
              <span className="text-fg-1 text-small">
                {l.entidade}{' '}
                <span className="text-fg-3 font-mono text-micro">
                  {l.entidadeId.slice(0, 8)}
                </span>
              </span>
            ),
          },
          {
            key: 'ip',
            header: 'IP',
            accessor: (l) => (
              <span className="font-mono text-micro text-fg-3">
                {l.ipAddress ?? '—'}
              </span>
            ),
          },
          {
            key: 'date',
            header: 'Quando',
            align: 'right',
            accessor: (l) => <RelativeTime date={l.criadoEm} />,
          },
        ]}
        empty="Nenhum evento de auditoria"
      />
    </>
  )
}
