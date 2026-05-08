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
import { useLiveQuotes, type LiveQuotePayload } from '@/lib/quotes/useLiveQuotes'
import { FuturosBook } from './FuturosBook'

const CURVE_TABS = [
  { value: 'fisico', label: 'À Vista' },
  { value: 'fob', label: 'FOB' },
  { value: 'b3', label: 'Futuro (B3)' },
  { value: 'cbot', label: 'Futuro (CBOT)' },
] as const

type CurveModo = (typeof CURVE_TABS)[number]['value']

interface CurvaResponse {
  data: { label: string; value: number }[]
  empty: boolean
  modo: CurveModo
  fonte: string
  unidade: string
  moeda: string
  ticker?: string
  observacao?: string
}

interface DashState {
  stats?: any
  batimento?: { itens: { label: string; value: number; color: string }[] }
  demanda?: { items: typeof DEMAND_GLOBAL }
  topContratos?: any[]
}

async function safeJson(url: string) {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${url} → ${r.status}`)
  return r.json()
}

function fmtBRL(v: number | null, fractionDigits = 2): string {
  if (v === null || !Number.isFinite(v)) return '—'
  return v.toLocaleString('pt-BR', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
}

function fmtPct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '0,00%'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(2).replace('.', ',')}%`
}

function liveToCard(
  label: 'soja' | 'milho' | 'trigo' | 'usdbrl',
  q: LiveQuotePayload | undefined,
  fallbackSparkline: number[],
  book: BookData | null = null,
) {
  const meta: Record<typeof label, { display: string; ticker: string; unit: string; grainColor: 'soja' | 'milho' | 'trigo' | 'usd'; fractionDigits: number }> = {
    soja:   { display: 'Soja',  ticker: 'ZS · CBOT',     unit: 'R$/sc 60kg',    grainColor: 'soja',  fractionDigits: 2 },
    milho:  { display: 'Milho', ticker: 'ZC · CBOT',     unit: 'R$/sc 60kg',    grainColor: 'milho', fractionDigits: 2 },
    trigo:  { display: 'Trigo', ticker: 'ZW · CBOT',     unit: 'R$/sc 60kg',    grainColor: 'trigo', fractionDigits: 2 },
    usdbrl: { display: 'Dólar', ticker: 'USDBRL',        unit: 'Comercial',     grainColor: 'usd',   fractionDigits: 4 },
  }
  const m = meta[label]
  const sparkline = (q?.sparkline?.length ?? 0) >= 2 ? q!.sparkline : fallbackSparkline

  // Fallback para preço: se mercado fechado / rate-limit / API offline,
  // usa o último valor conhecido (previousClose → último ponto do sparkline).
  // Assim Dólar/Soja/Milho/Trigo nunca aparecem "—" se já tivemos um preço.
  const lastSparkPrice = sparkline.length > 0 ? sparkline[sparkline.length - 1] : null
  const effectivePrice =
    (q?.price !== null && q?.price !== undefined ? q.price : null) ??
    q?.previousClose ??
    lastSparkPrice

  // Δ% só faz sentido quando temos o preço atual; senão indicamos "fechado"
  const isStale = (q?.price === null || q?.price === undefined) && effectivePrice !== null
  const trend: 'pos' | 'neg' = (q?.changePct ?? 0) >= 0 ? 'pos' : 'neg'

  // Min/Max do dia. Se nada disponível, usa min/max do sparkline (intervalo recente).
  const sparkMin = sparkline.length ? Math.min(...sparkline) : null
  const sparkMax = sparkline.length ? Math.max(...sparkline) : null
  const minVal = q?.low ?? sparkMin
  const maxVal = q?.high ?? sparkMax

  // Estado do mercado: 'open' | 'closed' | 'unknown'
  // Para CEPEA: usa marketState do payload (sempre 'open' nos dias úteis quando há ref do dia)
  // Para Twelve Data USDBRL: 'open' / 'closed' baseado no is_market_open
  const marketState: 'open' | 'closed' | 'unknown' =
    q?.marketState === 'open' ? 'open' :
    q?.marketState === 'closed' ? 'closed' :
    'unknown'

  // Bid/Ask vindo do endpoint /api/cotacoes/book
  // Para grãos: best bid/ask das suas propostas + fallback estimado
  // Para usdbrl: AwesomeAPI bid/ask reais (interbancário)
  const bidObj = book?.bid?.price !== null && book?.bid?.price !== undefined
    ? {
        value: fmtBRL(book.bid.price, m.fractionDigits),
        source: book.bid.source,
        real: book.bid.real,
      }
    : null
  const askObj = book?.ask?.price !== null && book?.ask?.price !== undefined
    ? {
        value: fmtBRL(book.ask.price, m.fractionDigits),
        source: book.ask.source,
        real: book.ask.real,
      }
    : null

  return {
    symbol: m.display,
    ticker: m.ticker,
    unit: m.unit,
    price: effectivePrice !== null ? `R$ ${fmtBRL(effectivePrice, m.fractionDigits)}` : '—',
    delta: {
      value: isStale ? 'Fechado' : fmtPct(q?.changePct ?? null),
      trend,
    },
    bid: bidObj,
    ask: askObj,
    // Mantém min/max como fallback caso book não chegue
    buy: bidObj ? undefined : (minVal !== null && minVal !== undefined ? fmtBRL(minVal, m.fractionDigits) : undefined),
    sell: askObj ? undefined : (maxVal !== null && maxVal !== undefined ? fmtBRL(maxVal, m.fractionDigits) : undefined),
    sparklineData: sparkline,
    grainColor: m.grainColor,
    marketState,
    lastSync: q?.fetchedAt,
    stale: isStale,
  }
}

interface BookSide {
  price: number | null
  source: string
  real: boolean
}
interface BookData {
  symbol: string
  bid: BookSide
  ask: BookSide
  mid: number | null
  spread: number | null
  spreadPct: number | null
  unidade: string
  fonte: string
}

export function DashboardContent() {
  const [curve, setCurve] = React.useState<CurveModo>('fisico')
  const [curva, setCurva] = React.useState<CurvaResponse | null>(null)
  const [curvaLoading, setCurvaLoading] = React.useState(true)
  const [data, setData] = React.useState<DashState>({})
  const [error, setError] = React.useState<string | null>(null)
  const [books, setBooks] = React.useState<Record<string, BookData | null>>({})
  const { data: live, loading: liveLoading } = useLiveQuotes()  // 20s default

  // Fetch book bid/ask para os 4 símbolos. Refetch a cada 30s.
  React.useEffect(() => {
    let cancel = false
    const symbols = ['soja', 'milho', 'trigo', 'usdbrl'] as const
    async function tick() {
      const results = await Promise.all(
        symbols.map((s) =>
          safeJson(`/api/cotacoes/book?grao=${s}`).catch(() => null) as Promise<BookData | null>
        )
      )
      if (cancel) return
      setBooks({
        soja: results[0],
        milho: results[1],
        trigo: results[2],
        usdbrl: results[3],
      })
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => { cancel = true; clearInterval(id) }
  }, [])

  React.useEffect(() => {
    let cancel = false
    Promise.all([
      safeJson('/api/dashboard/stats').catch(() => null),
      safeJson('/api/dashboard/batimento').catch(() => null),
      safeJson('/api/dashboard/demanda-exportacao').catch(() => null),
      safeJson('/api/contratos?limit=5').catch(() => null),
    ])
      .then(([stats, batimento, demanda, contratos]) => {
        if (cancel) return
        setData({ stats, batimento, demanda, topContratos: contratos?.data || [] })
      })
      .catch((e) => !cancel && setError(String(e)))
    return () => { cancel = true }
  }, [])

  // Curva de mercado — refetch quando trocar modo
  React.useEffect(() => {
    let cancel = false
    setCurvaLoading(true)
    safeJson(`/api/cotacoes/historia?grao=soja&modo=${curve}&dias=240`)
      .then((j: CurvaResponse) => { if (!cancel) { setCurva(j); setCurvaLoading(false) } })
      .catch(() => { if (!cancel) { setCurva(null); setCurvaLoading(false) } })
    return () => { cancel = true }
  }, [curve])

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
    curva && !curva.empty && curva.data.length > 0
      ? curva.data
      : null
  const curvaSubtitulo = curva
    ? `${curva.fonte}${curva.unidade ? ' · ' + curva.unidade : ''}${curva.observacao ? ' · ' + curva.observacao : ''}`
    : 'Carregando...'
  const curvaColor = curve === 'cbot' ? 'var(--info)' : 'var(--accent)'

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
        {(['soja', 'milho', 'trigo', 'usdbrl'] as const).map((label, i) => {
          const fallback = MARKETS[i]
          const q = live?.[label]
          if (liveLoading && !live) return <Skeleton key={label} height={260} />
          const cardProps = liveToCard(label, q, fallback.sparklineData, books[label] ?? null)
          return <MarketCard key={label} {...cardProps} />
        })}
      </div>

      {/* Book de Futuros (B3 próprio + CBOT proxy) */}
      <FuturosBook />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <CardHeader>
            <CardTitle eyebrow="MERCADO · COMPARATIVO">Curva de Mercado · Soja</CardTitle>
            <div className="flex items-center gap-3">
              <Tabs
                options={CURVE_TABS as any}
                value={curve}
                onChange={(v) => setCurve(v as CurveModo)}
                size="sm"
              />
              <IconButton aria-label="Mais opções"><MoreHorizontal className="h-4 w-4" /></IconButton>
            </div>
          </CardHeader>
          <p className="text-fg-3 text-small mb-4">{curvaSubtitulo}</p>
          {curvaLoading ? (
            <Skeleton height={240} />
          ) : !curvaData ? (
            <EmptyState
              icon={Inbox}
              title={curve === 'b3' ? 'Integração B3 disponível no Enterprise' : 'Sem histórico para este mercado'}
              description={curva?.observacao || 'Cotações vão aparecer conforme a sync diária.'}
            />
          ) : (
            <AreaChart data={curvaData} height={240} showAxis showGrid color={curvaColor} />
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
