/**
 * GET /api/cotacoes/watchlist?symbols=SOYB,CORN,...
 * Retorna quote+sparkline para cada símbolo. Default cobre commodities + FX.
 *
 * Símbolos via Twelve Data — usa ETFs Teucrium para grãos (SOYB/CORN/WEAT)
 * e pares forex (USD/BRL, EUR/BRL etc.). Café/Açúcar/Algodão usam ETFs proxy.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { fetchSparkline, type QuoteLabel } from '@/lib/quotes/twelvedata'

export const revalidate = 30

interface WatchSymbol {
  symbol: string
  label: string
  ticker: string
  sparklineLabel?: QuoteLabel  // se mapeia para nosso fetchSparkline interno
}

const DEFAULT_SYMBOLS: WatchSymbol[] = [
  { symbol: 'SOYB',    label: 'Soja',          ticker: 'SOYB',  sparklineLabel: 'soja' },
  { symbol: 'CORN',    label: 'Milho',         ticker: 'CORN',  sparklineLabel: 'milho' },
  { symbol: 'WEAT',    label: 'Trigo',         ticker: 'WEAT',  sparklineLabel: 'trigo' },
  { symbol: 'CANE',    label: 'Açúcar',        ticker: 'CANE'  }, // Teucrium Sugar (proxy)
  { symbol: 'JO',      label: 'Café',          ticker: 'JO'    }, // iPath Coffee (proxy)
  { symbol: 'BAL',     label: 'Algodão',       ticker: 'BAL'   }, // iPath Cotton (proxy)
  { symbol: 'USD/BRL', label: 'Dólar',         ticker: 'USDBRL', sparklineLabel: 'usdbrl' },
  { symbol: 'EUR/BRL', label: 'Euro',          ticker: 'EURBRL' },
  { symbol: 'CNY/BRL', label: 'Yuan',          ticker: 'CNYBRL' },
  { symbol: 'ARS/BRL', label: 'Peso AR',       ticker: 'ARSBRL' },
]

interface TDQuote {
  close?: string | number
  previous_close?: string | number
  percent_change?: string | number
  currency?: string
  status?: 'error' | 'ok'
  code?: number
}

async function fetchTwelveQuote(symbol: string, apiKey: string): Promise<TDQuote | null> {
  try {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    const j = await r.json() as TDQuote
    if (j.status === 'error' || j.code) return null
    return j
  } catch { return null }
}

async function fetchTwelveSparkline(symbol: string, apiKey: string): Promise<number[]> {
  try {
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=30&apikey=${apiKey}`
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!r.ok) return []
    const j = await r.json() as { values?: Array<{ close: string }>, status?: string }
    if (!j.values) return []
    return j.values.map((v) => Number(v.close)).filter(Number.isFinite).reverse()
  } catch { return [] }
}

function n(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') { const x = Number(v); return Number.isFinite(x) ? x : null }
  return null
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const apiKey = process.env.TWELVEDATA_API_KEY || ''
    if (!apiKey) {
      return NextResponse.json({ items: [], fetchedAt: new Date().toISOString(), error: 'TWELVEDATA_API_KEY não configurada' })
    }

    const { searchParams } = new URL(req.url)
    const param = searchParams.get('symbols')
    const list: WatchSymbol[] = param
      ? param.split(',').map((s) => {
          const trimmed = s.trim()
          const found = DEFAULT_SYMBOLS.find((d) => d.symbol === trimmed)
          return found || { symbol: trimmed, label: trimmed, ticker: trimmed }
        })
      : DEFAULT_SYMBOLS

    const items = await Promise.all(
      list.map(async (it) => {
        const [q, spark] = await Promise.all([
          fetchTwelveQuote(it.symbol, apiKey),
          it.sparklineLabel
            ? fetchSparkline(it.sparklineLabel)
            : fetchTwelveSparkline(it.symbol, apiKey),
        ])
        const price = q ? n(q.close) : null
        const prev = q ? n(q.previous_close) : null
        const changePct = q ? n(q.percent_change) : (price !== null && prev !== null && prev !== 0 ? ((price - prev) / prev) * 100 : null)
        return {
          symbol: it.symbol,
          label: it.label,
          ticker: it.ticker,
          price,
          previousClose: prev,
          changePct,
          currency: q?.currency || null,
          sparkline: spark,
        }
      })
    )

    return NextResponse.json(
      { items, fetchedAt: new Date().toISOString(), source: 'twelve-data' },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    )
  } catch (e: any) {
    console.error('GET /cotacoes/watchlist error:', e?.message || e)
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 500 })
  }
}
