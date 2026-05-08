'use client'
import * as React from 'react'
import { MoreHorizontal, Plus, Minus, Inbox } from 'lucide-react'
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
  EmptyState,
  Skeleton,
  ErrorBanner,
  type DenseTableColumn,
} from '@/components/ui/phb'
import {
  MARKETS,
  SOJA_CURVE,
  META_PROGRESS,
  DASHBOARD_KPIS,
  DEMAND_GLOBAL,
  type TopContractRow,
} from '@/lib/mocks/phb'

const CURVE_TABS = [
  { value: 'fisico', label: 'Físico' },
  { value: 'futuro', label: 'Futuro (B3)' },
  { value: 'fob', label: 'FOB Paranaguá' },
]

interface DashState {
  stats?: any
  batimento?: { itens: { label: string; value: number; color: string }[] }
  demanda?: { items: typeof DEMAND_GLOBAL }
  curva?: { data: { label: string; value: number }[]; empty: boolean }
  topContratos?: any[]
}

async function safeJson(url: string) {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${url} → ${r.status}`)
  return r.json()
}

export function DashboardContent() {
  const [curve, setCurve] = React.useState('fisico')
  const [data, setData] = React.useState<DashState>({})
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancel = false
    Promise.all([
      safeJson('/api/dashboard/stats').catch(() => null),
      safeJson('/api/dashboard/batimento').catch(() => null),
      safeJson('/api/dashboard/demanda-exportacao').catch(() => null),
      safeJson('/api/cotacoes/historia?grao=soja&dias=240').catch(() => null),
      safeJson('/api/contratos?limit=5').catch(() => null),
    ])
      .then(([stats, batimento, demanda, curva, contratos]) => {
        if (cancel) return
        setData({ stats, batimento, demanda, curva, topContratos: contratos?.data || [] })
      })
      .catch((e) => !cancel && setError(String(e)))
    return () => { cancel = true }
  }, [])

  if (error) return <ErrorBanner message={error} />

  const loaded = !!data.stats
  const k = data.stats?.kpis
  const sparks = data.stats?.sparklines || {}
  const kpis = loaded
    ? [
        { eyebrow: 'CONTATOS FEITOS', delta: { value: '', trend: 'pos' as const }, value: String(k?.contatosFeitos ?? 0), subtitle: `${k?.contatosFeitos ?? 0} clientes ativos`, sparklineData: DASHBOARD_KPIS[0].sparklineData, sparklineColor: 'var(--accent)' },
        { eyebrow: 'CONTRATOS EMITIDOS', delta: { value: '', trend: 'pos' as const }, value: String(k?.contratosEmitidos ?? 0), subtitle: 'YTD', sparklineData: sparks.emitidos?.length ? sparks.emitidos : DASHBOARD_KPIS[1].sparklineData, sparklineColor: 'var(--accent)' },
        { eyebrow: 'CONTRATOS ASSINADOS', delta: { value: '', trend: 'pos' as const }, value: String(k?.contratosAssinados ?? 0), subtitle: k?.contratosEmitidos > 0 ? `${Math.round(((k?.contratosAssinados ?? 0) / k.contratosEmitidos) * 100)}% taxa de conversão` : '—', sparklineData: sparks.assinados?.length ? sparks.assinados : DASHBOARD_KPIS[2].sparklineData, sparklineColor: 'var(--accent)' },
        { eyebrow: 'CONTRATOS FECHADOS', delta: { value: '', trend: 'pos' as const }, value: String(k?.contratosFechados ?? 0), subtitle: 'Tonelagem total', sparklineData: DASHBOARD_KPIS[3].sparklineData, sparklineColor: 'var(--neg)' },
        { eyebrow: 'COMPRADO', value: `${(k?.tonsCompradas ?? 0) >= 1000 ? `${Math.round((k?.tonsCompradas ?? 0) / 1000)}k t` : `${k?.tonsCompradas ?? 0} t`}`, subtitle: 'Safra atual', sparklineData: DASHBOARD_KPIS[4].sparklineData, sparklineColor: 'var(--accent)' },
      ]
    : DASHBOARD_KPIS

  const meta = data.batimento?.itens?.length ? data.batimento.itens : META_PROGRESS
  const demand = data.demanda?.items?.length ? data.demanda.items : DEMAND_GLOBAL
  const curvaData =
    data.curva && !data.curva.empty && data.curva.data.length > 0
      ? data.curva.data
      : SOJA_CURVE

  const topContratosRows: TopContractRow[] = (data.topContratos || []).map((c: any) => ({
    cliente: c?.cliente?.nome || '—',
    uf: '—',
    tipo: 'contrato físico',
    risco: 3,
    valor: c?.proposta?.valorTotal
      ? `R$ ${(Number(c.proposta.valorTotal) / 1_000_000).toFixed(2).replace('.', ',')}M`
      : '—',
  }))
  const showTopEmpty = topContratosRows.length === 0

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
    { key: 'risco', header: 'RISCO', accessor: (r) => <PipRow level={r.risco} size="sm" />, align: 'left' },
    { key: 'valor', header: 'VALOR', accessor: (r) => <span className="t-num text-fg-1">{r.valor}</span>, align: 'right', isNumeric: true },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {MARKETS.map((m) => <MarketCard key={m.symbol} {...m} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <CardHeader>
            <CardTitle eyebrow="MERCADO · COMPARATIVO">Curva de Mercado · Soja</CardTitle>
            <div className="flex items-center gap-3">
              <Tabs options={CURVE_TABS} value={curve} onChange={setCurve} size="sm" />
              <Pill>Últimos 8 meses</Pill>
              <IconButton aria-label="Mais opções"><MoreHorizontal className="h-4 w-4" /></IconButton>
            </div>
          </CardHeader>
          <p className="text-fg-3 text-small mb-4">Comparativo CEPEA × B3 × FOB</p>
          {!loaded ? (
            <Skeleton height={240} />
          ) : data.curva?.empty ? (
            <EmptyState icon={Inbox} title="Sem histórico ainda" description="Cotações começarão a aparecer assim que houver dados sincronizados." />
          ) : (
            <AreaChart data={curvaData} height={240} showAxis showGrid />
          )}
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="META · MENSAL">Batimento de Meta · Mês</CardTitle>
          </CardHeader>
          <p className="text-fg-3 text-small mb-5">vs orçamento da safra 24/25</p>
          {!loaded ? (
            <div className="space-y-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={20} />)}</div>
          ) : (
            <div className="space-y-4">
              {meta.map((m: any) => (
                <ProgressBar key={m.label} label={m.label} value={m.value} color={m.color} size="sm" />
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {!loaded
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={120} />)
          : kpis.map((k: any) => <KPICard key={k.eyebrow} {...k} />)}
      </div>

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
            <DemandList items={demand} />
            <div className="relative">
              <MapPlaceholder size={192} />
              <div className="absolute bottom-2 right-2 flex flex-col gap-1">
                <IconButton aria-label="Aproximar"><Plus className="h-3.5 w-3.5" /></IconButton>
                <IconButton aria-label="Afastar"><Minus className="h-3.5 w-3.5" /></IconButton>
              </div>
            </div>
          </div>
          <a href="#" className="mt-5 inline-block text-accent text-small hover:underline">Ver todos os destinos →</a>
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="MAIORES TICKETS">Top Contratos do Mês</CardTitle>
            <IconButton aria-label="Mais opções"><MoreHorizontal className="h-4 w-4" /></IconButton>
          </CardHeader>
          <p className="text-fg-3 text-small mb-4">Por valor total negociado</p>
          {!loaded ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={32} />)}</div>
          ) : showTopEmpty ? (
            <EmptyState icon={Inbox} title="Sem contratos ainda" description="Seus maiores contratos aparecerão aqui." />
          ) : (
            <DenseTable columns={topCols} rows={topContratosRows} rowKey={(r) => r.cliente} className="!border-0 !shadow-none !bg-transparent" />
          )}
        </Card>
      </div>
    </div>
  )
}
