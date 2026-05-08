import { db } from '@/lib/db'
import {
  PageHeader,
  Card,
  DenseTable,
  KPICard,
  BarChart,
} from '@/components/ui/phb'
import Link from 'next/link'
import { RelativeTime } from '../../_components/atoms'
import { ForceSyncButton } from './ForceSyncButton'

export const dynamic = 'force-dynamic'

export default async function CotacoesAdmin() {
  const last30d = new Date(Date.now() - 30 * 24 * 3600 * 1000)
  const [latestCepea, latestTd, recent, count30d, sojaSeries] =
    await Promise.all([
      db.cotacao.findFirst({
        where: { fonte: { contains: 'CEPEA', mode: 'insensitive' } },
        orderBy: { data: 'desc' },
      }),
      db.cotacao.findFirst({
        where: { fonte: { contains: 'TwelveData', mode: 'insensitive' } },
        orderBy: { data: 'desc' },
      }),
      db.cotacao.findMany({ orderBy: { data: 'desc' }, take: 50 }),
      db.cotacao.count({ where: { data: { gte: last30d } } }),
      db.cotacao.findMany({
        where: {
          grao: 'soja',
          data: { gte: new Date(Date.now() - 90 * 24 * 3600 * 1000) },
        },
        orderBy: { data: 'asc' },
      }),
    ])

  const navTabs = [
    { href: '/admin/operacional/cotacoes', label: 'Cotações', active: true },
    { href: '/admin/operacional/webhooks', label: 'Webhooks' },
    { href: '/admin/operacional/auditoria', label: 'Auditoria' },
  ]

  // Sparkline-friendly: agrupa diariamente
  const dailyMap = new Map<string, number[]>()
  for (const c of sojaSeries) {
    const key = c.data.toISOString().slice(0, 10)
    if (!dailyMap.has(key)) dailyMap.set(key, [])
    dailyMap.get(key)!.push(Number(c.preco))
  }
  const sojaDaily = [...dailyMap.entries()]
    .slice(-30)
    .map(([key, vals]) => ({
      label: key.slice(5),
      value: vals.reduce((a, b) => a + b, 0) / vals.length,
    }))

  return (
    <>
      <PageHeader
        eyebrow="ADMIN · OPERACIONAL"
        title="Cotações"
        subtitle="Status das fontes e histórico de snapshots"
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
          eyebrow="CEPEA"
          value={
            latestCepea
              ? `R$ ${Number(latestCepea.preco).toFixed(2)}`
              : '—'
          }
          subtitle={
            latestCepea
              ? `Última: ${new Date(latestCepea.data).toLocaleString('pt-BR')}`
              : 'Sem snapshot ainda'
          }
        />
        <KPICard
          eyebrow="Twelve Data"
          value={latestTd ? `R$ ${Number(latestTd.preco).toFixed(2)}` : '—'}
          subtitle={
            latestTd
              ? `Última: ${new Date(latestTd.data).toLocaleString('pt-BR')}`
              : 'Sem snapshot ainda'
          }
        />
        <KPICard
          eyebrow="Snapshots 30d"
          value={String(count30d)}
          subtitle="Total no banco (todas fontes)"
        />
      </div>

      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="eyebrow">Ações</p>
            <h3 className="text-fg-1 text-h3 font-semibold">
              Forçar sincronização
            </h3>
          </div>
          <ForceSyncButton />
        </div>
        <p className="text-fg-3 text-small">
          Dispara fetch CEPEA + Twelve Data e grava snapshots no banco.
        </p>
      </Card>

      {sojaDaily.length > 0 && (
        <Card className="p-5 mb-6">
          <div className="mb-4">
            <p className="eyebrow">Soja · 30 dias</p>
            <h3 className="text-fg-1 text-h3 font-semibold">
              Preço médio diário (R$/sc)
            </h3>
          </div>
          <BarChart data={sojaDaily} height={200} />
        </Card>
      )}

      <h3 className="text-fg-1 text-h3 font-semibold mb-3">
        Últimos 50 snapshots
      </h3>
      <DenseTable
        rowKey={(c) => c.id}
        rows={recent}
        columns={[
          {
            key: 'grao',
            header: 'Grão',
            accessor: (c) => (
              <span className="capitalize text-fg-1">{c.grao}</span>
            ),
          },
          {
            key: 'symbol',
            header: 'Símbolo',
            accessor: (c) => (
              <span className="font-mono text-fg-2 text-small">{c.simbolo}</span>
            ),
          },
          {
            key: 'preco',
            header: 'Preço',
            align: 'right',
            isNumeric: true,
            accessor: (c) => `R$ ${Number(c.preco).toFixed(2)}`,
          },
          {
            key: 'fonte',
            header: 'Fonte',
            accessor: (c) => (
              <span className="text-fg-2 text-small">{c.fonte}</span>
            ),
          },
          {
            key: 'usd',
            header: 'USD/BRL',
            align: 'right',
            accessor: (c) =>
              c.dolarReal
                ? Number(c.dolarReal).toFixed(4)
                : '—',
          },
          {
            key: 'date',
            header: 'Quando',
            align: 'right',
            accessor: (c) => <RelativeTime date={c.data} />,
          },
        ]}
        empty="Nenhum snapshot ainda"
      />
    </>
  )
}
