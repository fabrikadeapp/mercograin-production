import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import {
  PageHeader,
  DenseTable,
  Card,
  Chip,
  KPICard,
  Button,
} from '@/components/ui/phb'
import Link from 'next/link'
import { RelativeTime } from '../../_components/atoms'

export const dynamic = 'force-dynamic'

export default async function WebhooksAdmin({
  searchParams,
}: {
  searchParams?: { tipo?: string; status?: string }
}) {
  const tipo = searchParams?.tipo ?? 'all'
  const status = searchParams?.status ?? 'all'

  const where: Prisma.WebhookLogWhereInput = {}
  if (tipo !== 'all') where.tipo = tipo
  if (status !== 'all') where.status = status

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [logs, totalToday, errosToday, lastError] = await Promise.all([
    db.webhookLog.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      take: 100,
    }),
    db.webhookLog.count({ where: { criadoEm: { gte: today } } }),
    db.webhookLog.count({
      where: { criadoEm: { gte: today }, status: 'erro' },
    }),
    db.webhookLog.findFirst({
      where: { status: 'erro' },
      orderBy: { criadoEm: 'desc' },
    }),
  ])

  const successRate = totalToday
    ? (((totalToday - errosToday) / totalToday) * 100).toFixed(1)
    : '—'

  const navTabs = [
    { href: '/admin/operacional/cotacoes', label: 'Cotações' },
    {
      href: '/admin/operacional/webhooks',
      label: 'Webhooks',
      active: true,
    },
    { href: '/admin/operacional/auditoria', label: 'Auditoria' },
  ]

  return (
    <>
      <PageHeader
        eyebrow="ADMIN · OPERACIONAL"
        title="Webhooks"
        subtitle="Logs de webhooks Stripe, Braspag, TradingView, WhatsApp"
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KPICard
          eyebrow="Recebidos hoje"
          value={String(totalToday)}
          subtitle="Total de webhooks"
        />
        <KPICard
          eyebrow="% Sucesso"
          value={typeof successRate === 'string' ? successRate + '%' : successRate}
          subtitle={`${errosToday} erros`}
          highlightValue
        />
        <KPICard
          eyebrow="Último erro"
          value={lastError ? lastError.tipo : '—'}
          subtitle={
            lastError
              ? new Date(lastError.criadoEm).toLocaleString('pt-BR')
              : 'Nenhum erro registrado'
          }
        />
      </div>

      <Card className="p-4 mb-6">
        <form
          method="GET"
          action="/admin/operacional/webhooks"
          className="flex flex-wrap items-end gap-3"
        >
          <select
            name="tipo"
            defaultValue={tipo}
            className="px-3 py-2 bg-bg-2 border border-border-1 rounded-md text-fg-1 text-small"
          >
            <option value="all">Todos os tipos</option>
            <option value="stripe">Stripe</option>
            <option value="braspag">Braspag</option>
            <option value="tradingview">TradingView</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="signaturely">Signaturely</option>
          </select>
          <select
            name="status"
            defaultValue={status}
            className="px-3 py-2 bg-bg-2 border border-border-1 rounded-md text-fg-1 text-small"
          >
            <option value="all">Todos status</option>
            <option value="recebido">Recebido</option>
            <option value="processado">Processado</option>
            <option value="erro">Erro</option>
          </select>
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
            key: 'tipo',
            header: 'Tipo',
            accessor: (l) => (
              <span className="font-mono text-micro uppercase tracking-wider text-fg-2">
                {l.tipo}
              </span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            accessor: (l) => (
              <Chip
                variant={
                  l.status === 'erro'
                    ? 'neg'
                    : l.status === 'processado'
                      ? 'pos'
                      : 'warn'
                }
              >
                {l.status}
              </Chip>
            ),
          },
          {
            key: 'mensagem',
            header: 'Mensagem',
            accessor: (l) => (
              <span className="text-fg-1 text-small truncate block max-w-[280px]">
                {l.mensagem ??
                  String(
                    (l.payload as any)?.type ??
                      (l.payload as any)?.event ??
                      '—',
                  )}
              </span>
            ),
          },
          {
            key: 'codigoErro',
            header: 'Erro',
            accessor: (l) =>
              l.codigoErro ? (
                <span className="font-mono text-micro text-neg">
                  {l.codigoErro}
                </span>
              ) : (
                <span className="text-fg-3">—</span>
              ),
          },
          {
            key: 'ip',
            header: 'IP',
            accessor: (l) => (
              <span className="font-mono text-micro text-fg-3">
                {l.ipOrigem ?? '—'}
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
        empty="Nenhum webhook registrado"
      />
    </>
  )
}
