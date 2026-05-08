'use client'
import * as React from 'react'
import { Inbox } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  KPICard,
  BarChart,
  ProgressBar,
  Tabs,
  Chip,
  EmptyState,
  Skeleton,
  ErrorBanner,
} from '@/components/ui/phb'

const TABS = [
  { value: 'receita', label: 'Receita' },
  { value: 'margem', label: 'Margem' },
  { value: 'tonelagem', label: 'Tonelagem' },
]

interface ApiResumo {
  kpis: any[]
  receita12meses: { label: string; soja: number; milho: number; trigo: number; value: number }[]
  topClientes: { name: string; pct: number; value: string; color: string }[]
  origemGraos: { label: string; pct: number; color: string }[]
  canalVenda: { label: string; pct: number; color: string }[]
  logistica: { custoMedioT: string; leadTime: string; ocupacaoArmazem: string; quebraContratual: string; slaEntrega: string; nps: string; _mock?: boolean }
  empty?: boolean
}

async function safeJson(url: string) {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${url} → ${r.status}`)
  return r.json()
}

export function RelatoriosContent() {
  const [tab, setTab] = React.useState('receita')
  const [data, setData] = React.useState<ApiResumo | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancel = false
    safeJson('/api/relatorios/resumo')
      .then((d) => !cancel && setData(d))
      .catch((e) => !cancel && setError(String(e)))
    return () => { cancel = true }
  }, [])

  if (error) return <ErrorBanner message={error} />
  if (!data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={120} />)}
        </div>
        <Skeleton height={320} rounded="lg" />
      </div>
    )
  }

  const totalSoja = data.receita12meses.reduce((s, m) => s + m.soja, 0)
  const totalMilho = data.receita12meses.reduce((s, m) => s + m.milho, 0)
  const totalTrigo = data.receita12meses.reduce((s, m) => s + m.trigo, 0)
  const pico = data.receita12meses.reduce<{ label: string; value: number } | null>((p, m) => (!p || m.value > p.value ? { label: m.label, value: m.value } : p), null)
  const fmtM = (n: number) => `R$ ${(n / 1_000_000).toFixed(1).replace('.', ',')}M`

  const log = data.logistica
  const LOG_STATS = [
    { eyebrow: 'CUSTO MÉDIO POR T', value: log.custoMedioT },
    { eyebrow: 'LEAD TIME MÉDIO', value: log.leadTime },
    { eyebrow: 'OCUPAÇÃO ARMAZÉM', value: log.ocupacaoArmazem },
    { eyebrow: 'QUEBRA CONTRATUAL', value: log.quebraContratual },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.kpis.map((k: any) => <KPICard key={k.eyebrow} {...k} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <CardHeader>
            <CardTitle eyebrow="DESEMPENHO · 12 MESES">Receita por mês</CardTitle>
            <Tabs options={TABS} value={tab} onChange={setTab} size="sm" />
          </CardHeader>
          <p className="text-fg-3 text-small mb-4">Soja, Milho e Trigo empilhados</p>
          {data.empty ? (
            <EmptyState icon={Inbox} title="Sem receita ainda" description="Aceite uma proposta para começar a acompanhar a receita por mês." />
          ) : (
            <>
              <BarChart data={data.receita12meses} highlightLast height={280} />
              <div className="mt-4 pt-4 border-t border-border-1 flex items-center gap-6 text-small flex-wrap">
                <span className="flex items-center gap-2 text-fg-2">
                  <span className="h-2 w-2 rounded-pill" style={{ background: 'var(--accent)' }} />
                  Soja <span className="t-num text-fg-1 ml-1">{fmtM(totalSoja)}</span>
                </span>
                <span className="flex items-center gap-2 text-fg-2">
                  <span className="h-2 w-2 rounded-pill" style={{ background: 'var(--grain-milho)' }} />
                  Milho <span className="t-num text-fg-1 ml-1">{fmtM(totalMilho)}</span>
                </span>
                <span className="flex items-center gap-2 text-fg-2">
                  <span className="h-2 w-2 rounded-pill" style={{ background: 'var(--grain-trigo)' }} />
                  Trigo <span className="t-num text-fg-1 ml-1">{fmtM(totalTrigo)}</span>
                </span>
                {pico && (
                  <span className="ml-auto text-fg-3">
                    Pico: <span className="t-num text-fg-1">R$ {pico.value.toFixed(1).replace('.', ',')}M</span> em {pico.label}
                  </span>
                )}
              </div>
            </>
          )}
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="RANKING">Top clientes · YTD</CardTitle>
          </CardHeader>
          {data.topClientes.length === 0 ? (
            <EmptyState icon={Inbox} title="Sem clientes" />
          ) : (
            <div className="space-y-4">
              {data.topClientes.map((c) => (
                <div key={c.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-small">
                    <span className="text-fg-1 truncate">{c.name}</span>
                    <span className="t-num text-fg-1">{c.value}</span>
                  </div>
                  <ProgressBar value={c.pct} color={c.color} showValue={false} size="sm" label="" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="DISTRIBUIÇÃO">Origem dos grãos</CardTitle>
          </CardHeader>
          {data.origemGraos.length === 0 ? (
            <EmptyState icon={Inbox} title="Sem dados" description="Origem aparece quando há clientes com endereço cadastrado." />
          ) : (
            <div className="space-y-4">
              {data.origemGraos.map((o) => <ProgressBar key={o.label} label={o.label} value={o.pct} color={o.color} size="sm" />)}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="DISTRIBUIÇÃO">Canal de venda</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            {data.canalVenda.map((c) => <ProgressBar key={c.label} label={c.label} value={c.pct} color={c.color} size="sm" />)}
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
                <Chip variant="pos">{log.slaEntrega}</Chip>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-fg-2 text-small">NPS clientes</span>
                <Chip variant="pos">{log.nps}</Chip>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
