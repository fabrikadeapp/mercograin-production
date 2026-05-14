'use client'
import * as React from 'react'
import { Plus, BellOff } from 'lucide-react'
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
  EmptyState,
  Skeleton,
  ErrorBanner,
  type DenseTableColumn,
} from '@/components/ui/phb'
import { SOJA_DETAIL_CURVE, type FxRow } from '@/lib/mocks/phb'

const TIMEFRAMES = [
  { value: '1d', label: '1D' },
  { value: '1s', label: '1S' },
  { value: '1m', label: '1M' },
  { value: '6m', label: '6M' },
  { value: '1a', label: '1A' },
  { value: 'tudo', label: 'Tudo' },
]

// Twelve Data usa formato "USD/BRL" (não "USDBRL=X"). encodeURI é
// crítico aqui porque "/" e "=" precisam ser escapados na query string.
const FX_SYMBOLS = ['USD/BRL', 'EUR/BRL', 'CNY/BRL', 'ARS/BRL']

async function safeJson(url: string) {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${url} → ${r.status}`)
  return r.json()
}

function fmtBRL(n: number | null) {
  if (n === null || !Number.isFinite(n as number)) return '—'
  return (n as number).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function CotacoesContent() {
  const [tf, setTf] = React.useState('1m')
  const [historico, setHistorico] = React.useState<{ data: any[] } | null>(null)
  const [watchlist, setWatchlist] = React.useState<any[] | null>(null)
  const [news, setNews] = React.useState<any[] | null>(null)
  const [alerts, setAlerts] = React.useState<any[] | null>(null)
  const [fx, setFx] = React.useState<any[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancel = false
    setHistorico(null)  // mostra skeleton durante reload por troca de timeframe
    safeJson(`/api/cotacoes/historico?symbol=SOYB&periodo=${tf}`)
      .then((d) => !cancel && setHistorico(d))
      .catch(() => !cancel && setHistorico({ data: SOJA_DETAIL_CURVE }))
    return () => { cancel = true }
  }, [tf])

  React.useEffect(() => {
    let cancel = false
    Promise.all([
      safeJson('/api/cotacoes/watchlist').catch(() => null),
      safeJson('/api/cotacoes/noticias').catch(() => null),
      safeJson('/api/alertas').catch(() => null),
      safeJson(`/api/cotacoes/watchlist?symbols=${FX_SYMBOLS.map(encodeURIComponent).join(',')}`).catch(() => null),
    ])
      .then(([wl, ns, al, fxd]) => {
        if (cancel) return
        setWatchlist(wl?.items || [])
        setNews(ns?.items || [])
        setAlerts(al?.data || [])
        setFx(fxd?.items || [])
      })
      .catch((e) => !cancel && setError(String(e)))
    return () => { cancel = true }
  }, [])

  if (error) return <ErrorBanner message={error} />

  // Watchlist agora usa SOYB (ETF Teucrium proxy de soja CBOT)
  const sojaItem = watchlist?.find((w: any) => w.symbol === 'SOYB')
  const sojaPrice = sojaItem?.price ?? sojaItem?.previousClose ?? null
  const sojaChange = sojaItem?.changePct ?? null
  const trend: 'pos' | 'neg' = (sojaChange ?? 0) >= 0 ? 'pos' : 'neg'

  const fmtUsd = (n: number | null) => (n != null ? `US$ ${fmtBRL(n)}` : '—')
  const STATS = [
    { eyebrow: 'ABERTURA', value: fmtUsd((sojaItem as any)?.open) },
    { eyebrow: 'MÁXIMA', value: fmtUsd((sojaItem as any)?.high) },
    { eyebrow: 'MÍNIMA', value: fmtUsd((sojaItem as any)?.low) },
    { eyebrow: 'VOLUME', value: '—' },
    { eyebrow: 'SPREAD', value: '—' },
    { eyebrow: 'VWAP', value: '—' },
  ]

  // SOYB/CORN/WEAT são ETFs USD. USD/BRL e similares R$. Diferenciar por símbolo.
  const usdSymbols = new Set(['SOYB', 'CORN', 'WEAT'])
  const watchlistItems = (watchlist || []).map((w: any) => {
    const sym = String(w.symbol ?? '').toUpperCase()
    const isUsd = usdSymbols.has(sym)
    const prefix = isUsd ? 'US$' : sym.endsWith('/BRL') ? 'R$' : ''
    return {
      symbol: w.label,
      ticker: w.ticker,
      value: w.price != null ? `${prefix} ${fmtBRL(w.price)}`.trim() : '—',
      delta: {
        value: w.changePct !== null ? `${w.changePct >= 0 ? '+' : ''}${w.changePct.toFixed(2)}%` : '—',
        trend: (w.changePct ?? 0) >= 0 ? ('pos' as const) : ('neg' as const),
      },
      sparklineData: w.sparkline || [],
    }
  })

  const fxRows: FxRow[] = (fx || []).map((it: any) => {
    const price = it.price ?? it.previousClose
    return {
      par: it.symbol, // Twelve Data já entrega "USD/BRL"
      preco: price != null ? `R$ ${fmtBRL(price)}` : '—',
      delta:
        it.changePct !== null && it.changePct !== undefined
          ? `${it.changePct >= 0 ? '+' : ''}${it.changePct.toFixed(2)}%`
          : '—',
      trend: (it.changePct ?? 0) >= 0 ? 'pos' : 'neg',
    }
  })

  const fxCols: DenseTableColumn<FxRow>[] = [
    { key: 'par', header: 'PAR', accessor: (r) => <span className="text-fg-1 text-small">{r.par}</span> },
    { key: 'preco', header: 'PREÇO', accessor: (r) => <span className="t-num text-fg-1">{r.preco}</span>, align: 'right', isNumeric: true },
    { key: 'delta', header: 'DELTA', accessor: (r) => <span className={r.trend === 'pos' ? 't-num text-pos' : 't-num text-neg'}>{r.delta}</span>, align: 'right', isNumeric: true },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <CardHeader>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-h2 text-fg-1">Soja · ZS · CBOT</h2>
              {sojaChange !== null && (
                <Chip variant={trend}>{`${sojaChange >= 0 ? '+' : ''}${sojaChange.toFixed(2)}%`}</Chip>
              )}
              <Pill>tempo real</Pill>
            </div>
            <Tabs options={TIMEFRAMES} value={tf} onChange={setTf} size="sm" />
          </CardHeader>
          <p
            className="font-mono text-fg-1 mb-6 t-num"
            style={{ fontSize: '56px', lineHeight: 1, color: 'var(--accent)' }}
            title="SOYB · Teucrium Soybean Fund (ETF proxy soja CBOT) · cotado em US$"
          >
            {sojaPrice !== null ? (
              <>
                US$ {fmtBRL(sojaPrice)}
                <span
                  style={{
                    fontSize: 14,
                    color: 'var(--text-mute)',
                    fontFamily: 'var(--f-mono)',
                    marginLeft: 8,
                    letterSpacing: 0,
                  }}
                >
                  /cota ETF
                </span>
              </>
            ) : (
              '—'
            )}
          </p>
          <p className="text-fg-3 text-small mb-4">
            SOYB · Teucrium Soybean Fund (ETF) — proxy USD para soja CBOT. Para preço nativo
            em cents/bushel ou R$/sc, ver dashboard <code>/bhgrain</code>.
          </p>
          {!historico ? (
            <Skeleton height={320} />
          ) : (
            <AreaChart data={historico.data?.length ? historico.data : SOJA_DETAIL_CURVE} height={320} showAxis showGrid />
          )}
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
            <IconButton aria-label="Adicionar ativo"><Plus className="h-4 w-4" /></IconButton>
          </CardHeader>
          {!watchlist ? (
            <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={36} />)}</div>
          ) : watchlistItems.length === 0 ? (
            <EmptyState title="Sem ativos" />
          ) : (
            <WatchlistList items={watchlistItems} />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="MERCADO">Notícias do mercado</CardTitle>
          </CardHeader>
          {!news ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={28} />)}</div>
          ) : news.length === 0 ? (
            <EmptyState title="Sem notícias" />
          ) : (
            <div>{news.map((n: any, i: number) => (<NewsItem key={n.id || i} title={n.title} meta={n.meta} />))}</div>
          )}
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="MONITORAMENTO">Alertas ativos</CardTitle>
          </CardHeader>
          {!alerts ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={28} />)}</div>
          ) : alerts.length === 0 ? (
            <EmptyState icon={BellOff} title="Sem alertas" description="Crie um alerta para ser avisado quando o preço atingir um nível." />
          ) : (
            <div>
              {alerts.map((a: any) => (
                <AlertItem
                  key={a.id}
                  label={`${a.graoLabel} ${a.operador} R$ ${fmtBRL(Number(a.preco))}`}
                  status={a.status}
                  variant={a.status === 'disparado' ? 'warn' : 'neutral'}
                />
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="FX">Câmbio cruzado</CardTitle>
          </CardHeader>
          {!fx ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={28} />)}</div>
          ) : fxRows.length === 0 ? (
            <EmptyState title="Sem cotações" />
          ) : (
            <DenseTable columns={fxCols} rows={fxRows} rowKey={(r) => r.par} className="!border-0 !shadow-none !bg-transparent" />
          )}
        </Card>
      </div>
    </div>
  )
}
