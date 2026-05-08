/**
 * GET /api/cotacoes/watchlist?symbols=SOYB,CORN,...
 *
 * Cache em memória 60s por símbolo (twelvedata.ts) + sequencial para
 * não estourar 8 reqs/min do free tier.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  fetchQuoteBySymbol,
  fetchSparklineBySymbol,
  fetchSparkline,
  type QuoteLabel,
} from '@/lib/quotes/twelvedata'

export const dynamic = 'force-dynamic'

interface WatchSymbol {
  symbol: string
  label: string
  ticker: string
  sparklineLabel?: QuoteLabel  // se mapeia para nosso fetchSparkline interno
}

const DEFAULT_SYMBOLS: WatchSymbol[] = [
  { symbol: 'SOYB',    label: 'Soja',    ticker: 'SOYB',  sparklineLabel: 'soja' },
  { symbol: 'CORN',    label: 'Milho',   ticker: 'CORN',  sparklineLabel: 'milho' },
  { symbol: 'WEAT',    label: 'Trigo',   ticker: 'WEAT',  sparklineLabel: 'trigo' },
  { symbol: 'CANE',    label: 'Açúcar',  ticker: 'CANE'  },
  { symbol: 'JO',      label: 'Café',    ticker: 'JO'    },
  { symbol: 'BAL',     label: 'Algodão', ticker: 'BAL'   },
  { symbol: 'USD/BRL', label: 'Dólar',   ticker: 'USDBRL', sparklineLabel: 'usdbrl' },
  { symbol: 'EUR/BRL', label: 'Euro',    ticker: 'EURBRL' },
  { symbol: 'CNY/BRL', label: 'Yuan',    ticker: 'CNYBRL' },
  { symbol: 'ARS/BRL', label: 'Peso AR', ticker: 'ARSBRL' },
]

function n(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') { const x = Number(v); return Number.isFinite(x) ? x : null }
  return null
}

function normalizeSymbolParam(raw: string): string {
  // Aceita "USDBRL=X" -> "USD/BRL", "ZS=F" -> "SOYB"
  const map: Record<string, string> = {
    'ZS=F': 'SOYB', 'ZC=F': 'CORN', 'ZW=F': 'WEAT',
    'USDBRL=X': 'USD/BRL', 'EURBRL=X': 'EUR/BRL',
    'CNYBRL=X': 'CNY/BRL', 'ARSBRL=X': 'ARS/BRL',
  }
  return map[raw] || raw
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const param = searchParams.get('symbols')
    const list: WatchSymbol[] = param
      ? param.split(',').map((s) => {
          const trimmed = normalizeSymbolParam(s.trim())
          const found = DEFAULT_SYMBOLS.find((d) => d.symbol === trimmed)
          return found || { symbol: trimmed, label: trimmed, ticker: trimmed }
        })
      : DEFAULT_SYMBOLS

    // Sequencial para não estourar rate limit. Cache 60s no twelvedata.ts
    // garante que após o primeiro warmup, próximas chamadas são instantâneas.
    const items: any[] = []
    for (const it of list) {
      const q = await fetchQuoteBySymbol(it.symbol)
      const spark = it.sparklineLabel
        ? await fetchSparkline(it.sparklineLabel)
        : await fetchSparklineBySymbol(it.symbol)

      const price = q ? n(q.close) : null
      const prev = q ? n(q.previous_close) : null
      const changePct = q
        ? (n(q.percent_change) ?? (price !== null && prev !== null && prev !== 0 ? ((price - prev) / prev) * 100 : null))
        : null
      items.push({
        symbol: it.symbol,
        label: it.label,
        ticker: it.ticker,
        price,
        previousClose: prev,
        changePct,
        open: q ? n(q.open) : null,
        high: q ? n(q.high) : null,
        low: q ? n(q.low) : null,
        currency: q?.currency || null,
        sparkline: spark,
      })
    }

    return NextResponse.json(
      { items, fetchedAt: new Date().toISOString(), source: 'twelve-data' },
      {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      }
    )
  } catch (e: any) {
    console.error('GET /cotacoes/watchlist:', e?.message || e)
    return NextResponse.json({ error: e?.message || 'erro' }, { status: 500 })
  }
}
