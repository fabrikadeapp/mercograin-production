'use client'
import * as React from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  KPICard,
  BarChart,
  Donut,
  Tabs,
  Chip,
  DenseTable,
  type DenseTableColumn,
} from '@/components/ui/phb'
import {
  CASHFLOW_KPIS,
  CASHFLOW_BARS,
  CASHFLOW_DONUT,
  RECEIVABLES,
  PAYABLES,
  type CashflowRow,
} from '@/lib/mocks/phb'

const PERIOD = [
  { value: 'diario', label: 'Diário' },
  { value: 'semanal', label: 'Semanal' },
]

function CashflowTable({ rows }: { rows: CashflowRow[] }) {
  const cols: DenseTableColumn<CashflowRow>[] = [
    {
      key: 'label',
      header: 'CLIENTE',
      accessor: (r) => (
        <div className="flex flex-col">
          <span className="text-fg-1 text-small">{r.label}</span>
          <span className="eyebrow t-num">{r.ref}</span>
        </div>
      ),
    },
    {
      key: 'vence',
      header: 'VENCE',
      accessor: (r) => <span className="text-fg-2 text-small">{r.vence}</span>,
    },
    {
      key: 'valor',
      header: 'VALOR',
      accessor: (r) => <span className="t-num text-fg-1">{r.valor}</span>,
      align: 'right',
      isNumeric: true,
    },
    {
      key: 'status',
      header: 'STATUS',
      accessor: (r) => <Chip variant={r.variant}>{r.status}</Chip>,
      align: 'right',
    },
  ]
  return (
    <DenseTable
      columns={cols}
      rows={rows}
      rowKey={(r) => r.ref}
      className="!border-0 !shadow-none !bg-transparent"
    />
  )
}

export function FluxoContent() {
  const [period, setPeriod] = React.useState('diario')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {CASHFLOW_KPIS.map((k) => (
          <KPICard
            key={k.eyebrow}
            eyebrow={k.eyebrow}
            delta={k.delta}
            value={k.value}
            subtitle={k.subtitle}
            highlightValue={k.highlight}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="HORIZONTE 90D">Projeção · 90 dias</CardTitle>
            <Tabs options={PERIOD} value={period} onChange={setPeriod} size="sm" />
          </CardHeader>
          <p className="text-fg-3 text-small mb-4">Entradas vs saídas vs saldo acumulado</p>
          <BarChart data={CASHFLOW_BARS} highlightLast height={260} />
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="DISTRIBUIÇÃO">Composição</CardTitle>
          </CardHeader>
          <Donut data={CASHFLOW_DONUT} centerValue="R$ 12,4M" centerSubtitle="Total mês" size={220} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="ENTRADAS">A receber · próximos 7 dias</CardTitle>
            <Chip variant="warn">R$ 1,82M</Chip>
          </CardHeader>
          <CashflowTable rows={RECEIVABLES} />
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="SAÍDAS">A pagar · próximos 7 dias</CardTitle>
            <Chip variant="neg">R$ 1,12M</Chip>
          </CardHeader>
          <CashflowTable rows={PAYABLES} />
        </Card>
      </div>
    </div>
  )
}
