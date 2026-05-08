'use client'
import * as React from 'react'
import { Plus } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  AreaChart,
  Tabs,
  Chip,
  Pill,
  IconButton,
  WatchlistList,
  NewsItem,
  AlertItem,
  DenseTable,
  type DenseTableColumn,
} from '@/components/ui/phb'
import {
  SOJA_DETAIL_CURVE,
  WATCHLIST_ITEMS,
  NEWS_ITEMS,
  ALERTS,
  FX_CROSS,
  type FxRow,
} from '@/lib/mocks/phb'

const TIMEFRAMES = [
  { value: '1d', label: '1D' },
  { value: '1s', label: '1S' },
  { value: '1m', label: '1M' },
  { value: '6m', label: '6M' },
  { value: '1a', label: '1A' },
  { value: 'tudo', label: 'Tudo' },
]

const STATS = [
  { eyebrow: 'ABERTURA', value: '139,80' },
  { eyebrow: 'MÁXIMA', value: '143,10' },
  { eyebrow: 'MÍNIMA', value: '138,40' },
  { eyebrow: 'VOLUME', value: '48.230 sc' },
  { eyebrow: 'SPREAD', value: '0,30' },
  { eyebrow: 'VWAP', value: '141,82' },
]

export function CotacoesContent() {
  const [tf, setTf] = React.useState('1m')

  const fxCols: DenseTableColumn<FxRow>[] = [
    { key: 'par', header: 'PAR', accessor: (r) => <span className="text-fg-1 text-small">{r.par}</span> },
    {
      key: 'preco',
      header: 'PREÇO',
      accessor: (r) => <span className="t-num text-fg-1">{r.preco}</span>,
      align: 'right',
      isNumeric: true,
    },
    {
      key: 'delta',
      header: 'DELTA',
      accessor: (r) => (
        <span className={r.trend === 'pos' ? 't-num text-pos' : 't-num text-neg'}>{r.delta}</span>
      ),
      align: 'right',
      isNumeric: true,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <CardHeader>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-h2 text-fg-1">Soja · ZS · CBOT</h2>
              <Chip variant="pos">+1,8%</Chip>
              <Pill>tempo real</Pill>
            </div>
            <Tabs options={TIMEFRAMES} value={tf} onChange={setTf} size="sm" />
          </CardHeader>
          <p className="font-mono text-fg-1 mb-6 t-num" style={{ fontSize: '56px', lineHeight: 1, color: 'var(--accent)' }}>
            R$ 142,30
          </p>
          <AreaChart data={SOJA_DETAIL_CURVE} height={320} showAxis showGrid />
          <div className="mt-6 pt-6 border-t border-border-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {STATS.map((s) => (
              <div key={s.eyebrow} className="space-y-1">
                <p className="eyebrow">{s.eyebrow}</p>
                <p className="t-num text-fg-1 text-body">{s.value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="STREAMING">Watchlist</CardTitle>
            <IconButton aria-label="Adicionar ativo">
              <Plus className="h-4 w-4" />
            </IconButton>
          </CardHeader>
          <WatchlistList items={WATCHLIST_ITEMS} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="MERCADO">Notícias do mercado</CardTitle>
          </CardHeader>
          <div>
            {NEWS_ITEMS.map((n, i) => (
              <NewsItem key={i} title={n.title} meta={n.meta} />
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="MONITORAMENTO">Alertas ativos</CardTitle>
          </CardHeader>
          <div>
            {ALERTS.map((a, i) => (
              <AlertItem key={i} {...a} />
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="FX">Câmbio cruzado</CardTitle>
          </CardHeader>
          <DenseTable
            columns={fxCols}
            rows={FX_CROSS}
            rowKey={(r) => r.par}
            className="!border-0 !shadow-none !bg-transparent"
          />
        </Card>
      </div>
    </div>
  )
}
