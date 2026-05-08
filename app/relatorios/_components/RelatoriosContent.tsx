'use client'
import * as React from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  KPICard,
  BarChart,
  ProgressBar,
  Tabs,
  Chip,
} from '@/components/ui/phb'
import {
  REPORT_KPIS,
  REVENUE_BARS,
  TOP_CLIENTS,
  ORIGIN_GRAINS,
  SALES_CHANNELS,
} from '@/lib/mocks/phb'

const TABS = [
  { value: 'receita', label: 'Receita' },
  { value: 'margem', label: 'Margem' },
  { value: 'tonelagem', label: 'Tonelagem' },
]

const LOG_STATS = [
  { eyebrow: 'CUSTO MÉDIO POR T', value: 'R$ 184,20' },
  { eyebrow: 'LEAD TIME MÉDIO', value: '6,2 dias' },
  { eyebrow: 'OCUPAÇÃO ARMAZÉM', value: '78%' },
  { eyebrow: 'QUEBRA CONTRATUAL', value: '0,4%' },
]

export function RelatoriosContent() {
  const [tab, setTab] = React.useState('receita')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {REPORT_KPIS.map((k) => (
          <KPICard key={k.eyebrow} {...k} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <CardHeader>
            <CardTitle eyebrow="DESEMPENHO · 12 MESES">Receita por mês</CardTitle>
            <Tabs options={TABS} value={tab} onChange={setTab} size="sm" />
          </CardHeader>
          <p className="text-fg-3 text-small mb-4">Soja, Milho e Trigo empilhados</p>
          <BarChart data={REVENUE_BARS} highlightLast height={280} />
          <div className="mt-4 pt-4 border-t border-border-1 flex items-center gap-6 text-small flex-wrap">
            <span className="flex items-center gap-2 text-fg-2">
              <span className="h-2 w-2 rounded-pill" style={{ background: 'var(--accent)' }} />
              Soja <span className="t-num text-fg-1 ml-1">R$ 31,2M</span>
            </span>
            <span className="flex items-center gap-2 text-fg-2">
              <span className="h-2 w-2 rounded-pill" style={{ background: 'var(--grain-milho)' }} />
              Milho <span className="t-num text-fg-1 ml-1">R$ 13,1M</span>
            </span>
            <span className="flex items-center gap-2 text-fg-2">
              <span className="h-2 w-2 rounded-pill" style={{ background: 'var(--grain-trigo)' }} />
              Trigo <span className="t-num text-fg-1 ml-1">R$ 3,9M</span>
            </span>
            <span className="ml-auto text-fg-3">
              Pico: <span className="t-num text-fg-1">R$ 5,6M</span> em Ago
            </span>
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="RANKING">Top clientes · YTD</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            {TOP_CLIENTS.map((c) => (
              <div key={c.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-small">
                  <span className="text-fg-1 truncate">{c.name}</span>
                  <span className="t-num text-fg-1">{c.value}</span>
                </div>
                <ProgressBar value={c.pct} color={c.color} showValue={false} size="sm" label="" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="DISTRIBUIÇÃO">Origem dos grãos</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            {ORIGIN_GRAINS.map((o) => (
              <ProgressBar key={o.label} label={o.label} value={o.pct} color={o.color} size="sm" />
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="DISTRIBUIÇÃO">Canal de venda</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            {SALES_CHANNELS.map((c) => (
              <ProgressBar key={c.label} label={c.label} value={c.pct} color={c.color} size="sm" />
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="OPERACIONAL">Eficiência logística</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            {LOG_STATS.map((s) => (
              <div key={s.eyebrow} className="flex items-center justify-between">
                <p className="eyebrow">{s.eyebrow}</p>
                <p className="t-num text-fg-1 text-small">{s.value}</p>
              </div>
            ))}
            <div className="border-t border-border-1 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-fg-2 text-small">SLA entrega</span>
                <Chip variant="pos">98,2%</Chip>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-fg-2 text-small">NPS clientes</span>
                <Chip variant="pos">+72</Chip>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
