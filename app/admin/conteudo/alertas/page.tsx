import { db } from '@/lib/db'
import {
  PageHeader,
  DenseTable,
  Card,
  Chip,
  KPICard,
} from '@/components/ui/phb'
import Link from 'next/link'
import { RelativeTime } from '../../_components/atoms'

export const dynamic = 'force-dynamic'

export default async function AlertasAdmin() {
  const last24h = new Date(Date.now() - 24 * 3600 * 1000)
  const [alertas, totalAtivos, dispared24h, byGrao] = await Promise.all([
    db.alertaPreco.findMany({
      include: {
        workspace: {
          include: {
            owner: { select: { id: true, nome: true, email: true } },
          },
        },
      },
      orderBy: { criadoEm: 'desc' },
      take: 100,
    }),
    db.alertaPreco.count({ where: { status: 'ativo' } }),
    db.alertaPreco.count({
      where: { ultimoDisparo: { gte: last24h } },
    }),
    db.alertaPreco.groupBy({
      by: ['graoLabel'],
      _count: true,
      orderBy: { _count: { graoLabel: 'desc' } },
    }),
  ])

  const topGrao = byGrao[0]?.graoLabel ?? '—'

  return (
    <>
      <PageHeader
        eyebrow="ADMIN · CONTEÚDO"
        title="Alertas de preço"
        subtitle="Visão global de alertas configurados pelos usuários"
        search={false}
        showBell={false}
        actions={
          <div className="flex gap-2">
            <Link
              href="/admin/conteudo/classificados"
              className="px-3 py-2 rounded-md bg-bg-2 hover:bg-bg-3 border border-border-1 text-fg-3 text-small"
            >
              Classificados
            </Link>
            <Link
              href="/admin/conteudo/alertas"
              className="px-3 py-2 rounded-md bg-bg-2 hover:bg-bg-3 border border-border-1 text-fg-1 text-small"
            >
              Alertas
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KPICard
          eyebrow="Alertas ativos"
          value={String(totalAtivos)}
          subtitle="status = ativo"
          highlightValue
        />
        <KPICard
          eyebrow="Disparados 24h"
          value={String(dispared24h)}
          subtitle="ultimoDisparo nas últimas 24h"
        />
        <KPICard
          eyebrow="Grão mais alertado"
          value={topGrao}
          subtitle={byGrao[0] ? `${byGrao[0]._count} alertas` : '—'}
        />
      </div>

      <DenseTable
        rowKey={(a) => a.id}
        rows={alertas}
        columns={[
          {
            key: 'grao',
            header: 'Grão',
            accessor: (a) => <span className="capitalize">{a.graoLabel}</span>,
          },
          {
            key: 'condicao',
            header: 'Condição',
            accessor: (a) => (
              <span className="font-mono text-small">
                {a.symbol} {a.operador} {Number(a.preco).toFixed(2)}
              </span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            accessor: (a) => (
              <Chip
                variant={
                  a.status === 'ativo'
                    ? 'pos'
                    : a.status === 'disparado'
                      ? 'warn'
                      : 'neutral'
                }
              >
                {a.status}
              </Chip>
            ),
          },
          {
            key: 'user',
            header: 'Usuário',
            accessor: (a) => (
              <Link
                href={`/admin/usuarios/${a.workspace?.owner.id}`}
                className="hover:text-accent text-small"
              >
                {a.workspace?.owner.nome ?? '—'}
              </Link>
            ),
          },
          {
            key: 'last',
            header: 'Último disparo',
            align: 'right',
            accessor: (a) => <RelativeTime date={a.ultimoDisparo} />,
          },
          {
            key: 'created',
            header: 'Criado',
            align: 'right',
            accessor: (a) => <RelativeTime date={a.criadoEm} />,
          },
        ]}
        empty="Nenhum alerta cadastrado"
      />
    </>
  )
}
