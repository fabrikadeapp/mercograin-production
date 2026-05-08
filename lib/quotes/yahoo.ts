/**
 * Yahoo Finance live quotes for PHB Grain.
 *
 * Symbols (CBOT futures + FX):
 *   ZS=F   - Soybean Futures (USD cents/bushel)
 *   ZC=F   - Corn Futures    (USD cents/bushel)
 *   ZW=F   - Wheat Futures   (USD cents/bushel)
 *   USDBRL=X - USD/BRL spot  (BRL)
 *
 * NOTE on currency / unit:
 * Yahoo returns CBOT grain futures in **USD cents per bushel** (not R$/sc 60kg).
 * Conversion to R$/sc requires: cents/bu -> USD/bu -> USD/ton (* 36.7437) ->
 * BRL/ton (* USDBRL) -> BRL/sc (/ 16.6667).
 * Per task spec we expose values as-delivered with `currency` field; UI labels
 * the unit accordingly ("USD/bu" or "R$"). CEPEA-quality R$/sc conversion is
 * a future enhancement (see lib/quotes/README or follow-up task).
 */
import yahooFinance from 'yahoo-finance2'

// Suppress noisy notices (survey banner + historical deprecation).
try {
  // suppressNotices is available on recent versions; guard for older ones.
  ;(yahooFinance as any).suppressNotices?.(['ripHistorical', 'yahooSurvey'])
} catch {
  /* no-op */
}

export type QuoteLabel = 'soja' | 'milho' | 'trigo' | 'usdbrl'

export interface LiveQuote {
  symbol: string
  label: QuoteLabel
  price: number | null
  open: number | null
  high: number | null
  low: number | null
  previousClose: number | null
  changeAbs: number | null
  changePct: number | null
  currency: string
  exchangeName: string | null
  marketState: string | null
  fetchedAt: string
}

export const YAHOO_SYMBOLS: Record<QuoteLabel, { symbol: string; currency: string }> = {
  soja: { symbol: 'ZS=F', currency: 'USD' },
  milho: { symbol: 'ZC=F', currency: 'USD' },
  trigo: { symbol: 'ZW=F', currency: 'USD' },
  usdbrl: { symbol: 'USDBRL=X', currency: 'BRL' },
}

function emptyQuote(label: QuoteLabel, errMsg?: string): LiveQuote {
  const cfg = YAHOO_SYMBOLS[label]
  if (errMsg) {
    console.warn(`[yahoo] ${label} (${cfg.symbol}) failed: ${errMsg}`)
  }
  return {
    symbol: cfg.symbol,
    label,
    price: null,
    open: null,
    high: null,
    low: null,
    previousClose: null,
    changeAbs: null,
    changePct: null,
    currency: cfg.currency,
    exchangeName: null,
    marketState: null,
    fetchedAt: new Date().toISOString(),
  }
}

export async function fetchLiveQuote(label: QuoteLabel): Promise<LiveQuote> {
  const cfg = YAHOO_SYMBOLS[label]
  try {
    const q: any = await yahooFinance.quote(cfg.symbol)
    if (!q) return emptyQuote(label, 'empty response')

    const price = num(q.regularMarketPrice)
    const prev = num(q.regularMarketPreviousClose)
    const changeAbs = price !== null && prev !== null ? price - prev : null
    const changePct =
      price !== null && prev !== null && prev !== 0
        ? ((price - prev) / prev) * 100
        : null

    return {
      symbol: cfg.symbol,
      label,
      price,
      open: num(q.regularMarketOpen),
      high: num(q.regularMarketDayHigh),
      low: num(q.regularMarketDayLow),
      previousClose: prev,
      changeAbs,
      changePct,
      currency: q.currency || cfg.currency,
      exchangeName: q.fullExchangeName || q.exchange || null,
      marketState: q.marketState || null,
      fetchedAt: new Date().toISOString(),
    }
  } catch (e: any) {
    return emptyQuote(label, e?.message || String(e))
  }
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  return null
}

export async function fetchAllLiveQuotes(): Promise<Record<QuoteLabel, LiveQuote>> {
  const labels: QuoteLabel[] = ['soja', 'milho', 'trigo', 'usdbrl']
  const results = await Promise.all(labels.map((l) => fetchLiveQuote(l)))
  return {
    soja: results[0],
    milho: results[1],
    trigo: results[2],
    usdbrl: results[3],
  }
}
