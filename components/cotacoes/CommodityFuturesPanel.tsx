'use client'

/**
 * Real Time Commodity Futures Prices — widget no dashboard.
 *
 * 5 tabs: Price, Performance, Technical, Specification, Charts.
 * Fetch sob demanda quando o tab muda + auto-refresh 60s na tab Price.
 *
 * Os símbolos vêm de Workspace.dashboardSymbols ou DEFAULT (server-side).
 * Visualmente espelha o layout do Investing/CME usado de referência.
 */
import { useEffect, useState, useMemo } from 'react'
import { Loader2 } from 'lucide-react'

type Tab = 'price' | 'performance' | 'technical' | 'specification' | 'charts'

const TABS: { id: Tab; label: string }[] = [
  { id: 'price', label: 'Price' },
  { id: 'performance', label: 'Performance' },
  { id: 'technical', label: 'Technical' },
  { id: 'specification', label: 'Specification' },
  { id: 'charts', label: 'Charts' },
]

const FLAG: Record<string, string> = {
  US: '🇺🇸', GB: '🇬🇧', NL: '🇳🇱', XX: '🌐',
}

interface PriceRow {
  id: string
  name: string
  symbol: string
  country: string
  contractMonth: string | null
  price: number | null
  high: number | null
  low: number | null
  changeAbs: number | null
  changePct: number | null
  marketTime: number | null
}

interface PerfRow {
  id: string
  name: string
  country: string
  daily: number | null
  week1: number | null
  month1: number | null
  ytd: number | null
  year1: number | null
  year3: number | null
}

interface TechRow {
  id: string
  name: string
  country: string
  rsi14: number | null
  ema20: number | null
  ema50: number | null
  last: number | null
}

interface SpecRow {
  id: string
  name: string
  country: string
  rootSymbol: string | null
  exchange: string
  contractSize: string | null
  monthsCode: string | null
  pointValue: string | null
}

interface ChartRow {
  id: string
  name: string
  country: string
  closes: number[]
}

function fmtPrice(n: number | null, digits = 2): string {
  if (n === null) return '—'
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function fmtPct(n: number | null): string {
  if (n === null) return '—'
  const s = n > 0 ? '+' : ''
  return `${s}${n.toFixed(2)}%`
}

function fmtTime(epoch: number | null): string {
  if (!epoch) return '—'
  const d = new Date(epoch * 1000)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function colorClass(n: number | null): string {
  if (n === null || n === 0) return 'text-gray-700'
  return n > 0 ? 'text-emerald-600' : 'text-red-600'
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-xs text-gray-400">sem dados</span>
  const w = 120
  const h = 32
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const trend = values[values.length - 1] >= values[0] ? 'stroke-emerald-500' : 'stroke-red-500'
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline fill="none" strokeWidth={1.5} points={pts} className={trend} />
    </svg>
  )
}

function RsiBadge({ rsi }: { rsi: number | null }) {
  if (rsi === null) return <span className="text-gray-400">—</span>
  const cls =
    rsi >= 70
      ? 'bg-red-50 text-red-700 border-red-200'
      : rsi <= 30
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-gray-50 text-gray-700 border-gray-200'
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-xs font-mono ${cls}`}>
      {rsi.toFixed(1)}
    </span>
  )
}

export function CommodityFuturesPanel() {
  const [tab, setTab] = useState<Tab>('price')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<any[]>([])

  // Fetch quando tab muda; refresh em loop só na Price.
  useEffect(() => {
    let cancelled = false
    let timer: NodeJS.Timeout | null = null

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const r = await fetch(`/api/cotacoes/commodities?tab=${tab}`, { cache: 'no-store' })
        const data = await r.json()
        if (cancelled) return
        if (!r.ok) throw new Error(data?.error || 'Falha ao carregar')
        setRows(data.rows ?? [])
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'erro')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    if (tab === 'price') {
      timer = setInterval(load, 60_000)
    }
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [tab])

  const header = useMemo(() => {
    switch (tab) {
      case 'price':
        return ['Name', 'Month', 'Last', 'High', 'Low', 'Chg.', 'Chg. %', 'Time']
      case 'performance':
        return ['Name', 'Daily', '1 Week', '1 Month', 'YTD', '1 Year', '3 Years']
      case 'technical':
        return ['Name', 'Last', 'RSI(14)', 'EMA(20)', 'EMA(50)']
      case 'specification':
        return ['Name', 'Symbol', 'Exchange', 'Contract Size', 'Months', 'Point Value']
      case 'charts':
        return ['Name', 'Last 90d']
    }
  }, [tab])

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Real Time Commodity Futures Prices
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Auto-refresh 60s · Yahoo Finance · Personalize em Configurações &rsaquo; Cotações
          </p>
        </div>
        <div className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                tab === t.id
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="px-5 py-3 text-sm text-red-700 bg-red-50">{error}</div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {header.map((h, i) => (
                <th
                  key={i}
                  className={`px-4 py-2.5 text-${
                    i === 0 ? 'left' : 'right'
                  } text-xs font-semibold text-gray-600`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={header.length} className="px-4 py-10 text-center text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin inline" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={header.length} className="px-4 py-10 text-center text-gray-400">
                  Sem commodities configuradas neste workspace.
                </td>
              </tr>
            ) : (
              rows.map((row: any) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-left">
                    <span className="mr-2">{FLAG[row.country] ?? '·'}</span>
                    <span className="text-gray-900">{row.name}</span>
                  </td>
                  {tab === 'price' ? <PriceCells row={row as PriceRow} /> : null}
                  {tab === 'performance' ? <PerfCells row={row as PerfRow} /> : null}
                  {tab === 'technical' ? <TechCells row={row as TechRow} /> : null}
                  {tab === 'specification' ? <SpecCells row={row as SpecRow} /> : null}
                  {tab === 'charts' ? <ChartCells row={row as ChartRow} /> : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PriceCells({ row }: { row: PriceRow }) {
  return (
    <>
      <td className="px-4 py-2 text-right text-gray-700">{row.contractMonth ?? ''}</td>
      <td className="px-4 py-2 text-right font-mono">{fmtPrice(row.price)}</td>
      <td className="px-4 py-2 text-right font-mono text-gray-700">{fmtPrice(row.high)}</td>
      <td className="px-4 py-2 text-right font-mono text-gray-700">{fmtPrice(row.low)}</td>
      <td className={`px-4 py-2 text-right font-mono ${colorClass(row.changeAbs)}`}>
        {row.changeAbs !== null ? (row.changeAbs > 0 ? '+' : '') + fmtPrice(row.changeAbs) : '—'}
      </td>
      <td className={`px-4 py-2 text-right font-mono ${colorClass(row.changePct)}`}>
        {fmtPct(row.changePct)}
      </td>
      <td className="px-4 py-2 text-right text-gray-500 text-xs">{fmtTime(row.marketTime)}</td>
    </>
  )
}

function PerfCells({ row }: { row: PerfRow }) {
  return (
    <>
      <td className={`px-4 py-2 text-right font-mono ${colorClass(row.daily)}`}>{fmtPct(row.daily)}</td>
      <td className={`px-4 py-2 text-right font-mono ${colorClass(row.week1)}`}>{fmtPct(row.week1)}</td>
      <td className={`px-4 py-2 text-right font-mono ${colorClass(row.month1)}`}>{fmtPct(row.month1)}</td>
      <td className={`px-4 py-2 text-right font-mono ${colorClass(row.ytd)}`}>{fmtPct(row.ytd)}</td>
      <td className={`px-4 py-2 text-right font-mono ${colorClass(row.year1)}`}>{fmtPct(row.year1)}</td>
      <td className={`px-4 py-2 text-right font-mono ${colorClass(row.year3)}`}>{fmtPct(row.year3)}</td>
    </>
  )
}

function TechCells({ row }: { row: TechRow }) {
  const trend =
    row.last !== null && row.ema20 !== null
      ? row.last > row.ema20
        ? 'text-emerald-600'
        : 'text-red-600'
      : 'text-gray-700'
  return (
    <>
      <td className="px-4 py-2 text-right font-mono text-gray-700">{fmtPrice(row.last)}</td>
      <td className="px-4 py-2 text-right">
        <RsiBadge rsi={row.rsi14} />
      </td>
      <td className={`px-4 py-2 text-right font-mono ${trend}`}>{fmtPrice(row.ema20)}</td>
      <td className="px-4 py-2 text-right font-mono text-gray-700">{fmtPrice(row.ema50)}</td>
    </>
  )
}

function SpecCells({ row }: { row: SpecRow }) {
  return (
    <>
      <td className="px-4 py-2 text-right font-mono text-gray-700">{row.rootSymbol ?? '—'}</td>
      <td className="px-4 py-2 text-right text-gray-700">{row.exchange}</td>
      <td className="px-4 py-2 text-right text-gray-700">{row.contractSize ?? '—'}</td>
      <td className="px-4 py-2 text-right font-mono text-gray-500 text-xs">{row.monthsCode ?? '—'}</td>
      <td className="px-4 py-2 text-right font-mono text-gray-700">{row.pointValue ?? '—'}</td>
    </>
  )
}

function ChartCells({ row }: { row: ChartRow }) {
  return (
    <td className="px-4 py-2 text-right">
      <div className="inline-block">
        <Sparkline values={row.closes} />
      </div>
    </td>
  )
}
