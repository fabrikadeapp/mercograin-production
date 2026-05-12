'use client'

/**
 * Tabelas do dashboard admin como client component para que as funções
 * `accessor` não precisem atravessar a fronteira server→client.
 *
 * Recebe apenas dados puros (rows) do server e renderiza tudo localmente.
 */
import Link from 'next/link'
import { DenseTable } from '@/components/ui/phb'
import { StatusBadge, RelativeTime, PlanBadge } from './atoms'

interface SignupRow {
  id: string
  nome: string | null
  email: string
  criadoEm: Date
  subscription?: { plan: string | null; status: string | null } | null
}

interface TransactionRow {
  id: string
  tipo: string
  status: string
  criadoEm: Date
  payload: unknown
}

export function SignupsTable({ rows }: { rows: SignupRow[] }) {
  return (
    <DenseTable
      rowKey={(r) => r.id}
      rows={rows}
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
          accessor: (r) => <StatusBadge status={r.subscription?.status} />,
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
  )
}

export function TransactionsTable({ rows }: { rows: TransactionRow[] }) {
  return (
    <DenseTable
      rowKey={(r) => r.id}
      rows={rows}
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
              (r.payload as any)?.type ?? (r.payload as any)?.event ?? '—'
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
  )
}
