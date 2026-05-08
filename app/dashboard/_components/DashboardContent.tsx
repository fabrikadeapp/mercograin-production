'use client'
import * as React from 'react'
import { MoreHorizontal, Plus, Minus } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  KPICard,
  MarketCard,
  AreaChart,
  Tabs,
  Pill,
  ProgressBar,
  DemandList,
  DenseTable,
  PipRow,
  IconButton,
  MapPlaceholder,
  type DenseTableColumn,
} from '@/components/ui/phb'
import {
  MARKETS,
  SOJA_CURVE,
  META_PROGRESS,
  DASHBOARD_KPIS,
  DEMAND_GLOBAL,
  TOP_CONTRACTS,
  type TopContractRow,
} from '@/lib/mocks/phb'

const CURVE_TABS = [
  { value: 'fisico', label: 'Físico' },
  { value: 'futuro', label: 'Futuro (B3)' },
  { value: 'fob', label: 'FOB Paranaguá' },
]

export function DashboardContent() {
  const [curve, setCurve] = React.useState('fisico')

  const topCols: DenseTableColumn<TopContractRow>[] = [
    {
      key: 'cliente',
      header: 'CLIENTE',
      accessor: (r) => (
        <div className="flex flex-col">
          <span className="text-fg-1 text-small">{r.cliente}</span>
          <span className="eyebrow">{`${r.uf} · ${r.tipo}`}</span>
        </div>
      ),
    },
    {
      key: 'risco',
      header: 'RISCO',
      accessor: (r) => <PipRow level={r.risco} size="sm" />,
      align: 'left',
    },
    {
      key: 'valor',
      header: 'VALOR',
      accessor: (r) => <span className="t-num text-fg-1">{r.valor}</span>,
      align: 'right',
      isNumeric: true,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Row 1: Markets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {MARKETS.map((m) => (
          <MarketCard key={m.symbol} {...m} />
        ))}
      </div>

      {/* Row 2: Curve + Meta */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <CardHeader>
            <CardTitle eyebrow="MERCADO · COMPARATIVO">
              Curva de Mercado · Soja
            </CardTitle>
            <div className="flex items-center gap-3">
              <Tabs options={CURVE_TABS} value={curve} onChange={setCurve} size="sm" />
              <Pill>Últimos 8 meses</Pill>
              <IconButton aria-label="Mais opções">
                <MoreHorizontal className="h-4 w-4" />
              </IconButton>
            </div>
          </CardHeader>
          <p className="text-fg-3 text-small mb-4">
            Comparativo CEPEA × B3 × FOB
          </p>
          <AreaChart data={SOJA_CURVE} height={240} showAxis showGrid />
          <div className="mt-4 pt-4 border-t border-border-1 flex items-center gap-6 text-small">
            <span className="flex items-center gap-2 text-fg-2">
              <span className="h-2 w-2 rounded-pill" style={{ background: 'var(--accent)' }} />
              CEPEA
            </span>
            <span className="flex items-center gap-2 text-fg-2">
              <span className="h-2 w-2 rounded-pill" style={{ background: 'var(--info)' }} />
              B3
            </span>
            <span className="flex items-center gap-2 text-fg-2">
              <span className="h-2 w-2 rounded-pill" style={{ background: 'var(--grain-trigo)' }} />
              FOB
            </span>
            <span className="ml-auto text-fg-3">
              Pico: <span className="t-num text-fg-1">R$ 148,10</span> em 14 Mai
            </span>
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="META · MENSAL">Batimento de Meta · Mês</CardTitle>
          </CardHeader>
          <p className="text-fg-3 text-small mb-5">vs orçamento da safra 24/25</p>
          <div className="space-y-4">
            {META_PROGRESS.map((m) => (
              <ProgressBar key={m.label} label={m.label} value={m.value} color={m.color} size="sm" />
            ))}
          </div>
        </Card>
      </div>

      {/* Row 3: KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {DASHBOARD_KPIS.map((k) => (
          <KPICard key={k.eyebrow} {...k} />
        ))}
      </div>

      {/* Row 4: Demand + Top contracts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <CardHeader>
            <div className="space-y-1">
              <p className="eyebrow">EXPORTAÇÃO · 7 DIAS</p>
              <h3 className="text-h3 text-fg-1">Demanda Global</h3>
              <p className="text-fg-3 text-small">
                <span className="t-num text-pos">+6,9%</span> · 142.380 t embarcadas — últimos 7 dias
              </p>
            </div>
          </CardHeader>
          <div className="grid grid-cols-[1fr_auto] gap-6 items-start">
            <DemandList items={DEMAND_GLOBAL} />
            <div className="relative">
              <MapPlaceholder size={192} />
              <div className="absolute bottom-2 right-2 flex flex-col gap-1">
                <IconButton aria-label="Aproximar">
                  <Plus className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton aria-label="Afastar">
                  <Minus className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            </div>
          </div>
          <a href="#" className="mt-5 inline-block text-accent text-small hover:underline">
            Ver todos os destinos →
          </a>
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="MAIORES TICKETS">Top Contratos do Mês</CardTitle>
            <IconButton aria-label="Mais opções">
              <MoreHorizontal className="h-4 w-4" />
            </IconButton>
          </CardHeader>
          <p className="text-fg-3 text-small mb-4">Por valor total negociado</p>
          <DenseTable
            columns={topCols}
            rows={TOP_CONTRACTS}
            rowKey={(r) => r.cliente}
            className="!border-0 !shadow-none !bg-transparent"
          />
        </Card>
      </div>
    </div>
  )
}
