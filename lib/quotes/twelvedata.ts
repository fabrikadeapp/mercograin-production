/**
 * Twelve Data live quotes for PHB Grain.
 *
 * Free tier: 800 req/dia · 8 req/min. Cache agressivo em memória pra evitar
 * estouro do rate limit (várias páginas/usuários em paralelo).
 *
 * Símbolos:
 *   SOYB     - Teucrium Soybean Fund (ETF proxy soja CBOT) — USD
 *   CORN     - Teucrium Corn Fund    (ETF proxy milho CBOT) — USD
 *   WEAT     - Teucrium Wheat Fund   (ETF proxy trigo CBOT) — USD
 *   USD/BRL  - Câmbio dólar comercial — BRL
 *
 * Para preços brasileiros oficiais use lib/quotes/cepea.ts.
 */

const API_BASE = 'https://api.twelvedata.com'
const API_KEY = process.env.TWELVEDATA_API_KEY || ''

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

interface SymbolConfig {
  symbol: string
  displayName: string
  currency: string
  fallbackCurrency: string
}

export const TD_SYMBOLS: Record<QuoteLabel, SymbolConfig> = {
  soja:   { symbol: 'SOYB',    displayName: 'SOYB · NYSE', currency: 'USD', fallbackCurrency: 'USD' },
  milho:  { symbol: 'CORN',    displayName: 'CORN · NYSE', currency: 'USD', fallbackCurrency: 'USD' },
  trigo:  { symbol: 'WEAT',    displayName: 'WEAT · NYSE', currency: 'USD', fallbackCurrency: 'USD' },
  usdbrl: { symbol: 'USD/BRL', displayName: 'USD/BRL',     currency: 'BRL', fallbackCurrency: 'BRL' },
}

// ============================================================================
// CACHE EM MEMÓRIA — chave por (endpoint, params)
// ============================================================================
interface CacheEntry<T> { data: T; at: number }
const QUOTE_TTL = 60_000          // 1 min — cotações
const TIMESERIES_TTL = 3_600_000  // 1 hora — histórico
const quoteCache = new Map<string, CacheEntry<TwelveDataQuote | null>>()
const timeseriesCache = new Map<string, CacheEntry<number[] | TimeseriesPoint[]>>()

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function emptyQuote(label: QuoteLabel, errMsg?: string): LiveQuote {
  const cfg = TD_SYMBOLS[label]
  if (errMsg) console.warn(`[twelvedata] ${label} (${cfg.symbol}) failed: ${errMsg}`)
  return {
    symbol: cfg.symbol,
    label,
    price: null, open: null, high: null, low: null, previousClose: null,
    changeAbs: null, changePct: null,
    currency: cfg.fallbackCurrency,
    exchangeName: null, marketState: null,
    fetchedAt: new Date().toISOString(),
  }
}

interface TwelveDataQuote {
  symbol: string
  exchange?: string
  currency?: string
  open?: string | number
  high?: string | number
  low?: string | number
  close?: string | number
  previous_close?: string | number
  change?: string | number
  percent_change?: string | number
  is_market_open?: boolean
  status?: 'error' | 'ok'
  code?: number
  message?: string
}

export interface TimeseriesPoint {
  datetime: string
  close: number
}

/**
 * Fetch quote bruto com cache. Retorna null se rate-limit, erro ou sem chave.
 */
async function getQuoteRaw(symbol: string): Promise<TwelveDataQuote | null> {
  if (!API_KEY) return null
  const now = Date.now()
  const cacheKey = `q:${symbol}`
  const cached = quoteCache.get(cacheKey)
  if (cached && now - cached.at < QUOTE_TTL) return cached.data

  try {
    const url = `${API_BASE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${API_KEY}`
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!r.ok) {
      // Não cacheia erro pra permitir retry
      console.warn(`[twelvedata] HTTP ${r.status} para ${symbol}`)
      return null
    }
    const j = (await r.json()) as TwelveDataQuote
    if (j.status === 'error' || j.code) {
      console.warn(`[twelvedata] ${symbol}: ${j.message || j.code}`)
      // Cacheia o erro temporariamente pra não martelar (curto: 30s)
      quoteCache.set(cacheKey, { data: null, at: now - QUOTE_TTL + 30_000 })
      return null
    }
    quoteCache.set(cacheKey, { data: j, at: now })
    return j
  } catch (e: any) {
    console.warn(`[twelvedata] erro em ${symbol}:`, e?.message || e)
    return null
  }
}

/**
 * Fetch timeseries com cache. Retorna [] se erro.
 */
async function getTimeseriesRaw(
  symbol: string,
  interval: string,
  outputsize: number,
): Promise<TimeseriesPoint[]> {
  if (!API_KEY) return []
  const now = Date.now()
  const cacheKey = `ts:${symbol}:${interval}:${outputsize}`
  const cached = timeseriesCache.get(cacheKey) as CacheEntry<TimeseriesPoint[]> | undefined
  if (cached && now - cached.at < TIMESERIES_TTL) return cached.data

  try {
    const url = `${API_BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputsize}&apikey=${API_KEY}`
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
    if (!r.ok) return []
    const j = (await r.json()) as { values?: Array<{ datetime: string; close: string }>; status?: string }
    if (!j.values) return []
    const points: TimeseriesPoint[] = j.values
      .map((v) => ({ datetime: v.datetime, close: Number(v.close) }))
      .filter((p) => Number.isFinite(p.close))
      .reverse()
    timeseriesCache.set(cacheKey, { data: points, at: now })
    return points
  } catch (e: any) {
    console.warn(`[twelvedata] timeseries ${symbol} failed:`, e?.message || e)
    return []
  }
}

// ============================================================================
// API PÚBLICA
// ============================================================================

export async function fetchLiveQuote(label: QuoteLabel): Promise<LiveQuote> {
  const cfg = TD_SYMBOLS[label]
  const q = await getQuoteRaw(cfg.symbol)
  if (!q) return emptyQuote(label, 'sem dados (cache miss + falha)')

  const price = num(q.close)
  const prev = num(q.previous_close)
  const changeAbs = num(q.change) ?? (price !== null && prev !== null ? price - prev : null)
  const changePct = num(q.percent_change) ??
    (price !== null && prev !== null && prev !== 0 ? ((price - prev) / prev) * 100 : null)

  return {
    symbol: cfg.symbol,
    label,
    price,
    open: num(q.open),
    high: num(q.high),
    low: num(q.low),
    previousClose: prev,
    changeAbs,
    changePct,
    currency: q.currency || cfg.fallbackCurrency,
    exchangeName: q.exchange || null,
    marketState: typeof q.is_market_open === 'boolean'
      ? (q.is_market_open ? 'open' : 'closed')
      : null,
    fetchedAt: new Date().toISOString(),
  }
}

export async function fetchAllLiveQuotes(): Promise<Record<QuoteLabel, LiveQuote>> {
  // Sequencial para não estourar rate limit (4 reqs em ~500ms tudo bem)
  const labels: QuoteLabel[] = ['soja', 'milho', 'trigo', 'usdbrl']
  const out = {} as Record<QuoteLabel, LiveQuote>
  for (const l of labels) out[l] = await fetchLiveQuote(l)
  return out
}

/**
 * Sparkline ~30 dias diários para um símbolo conhecido.
 */
export async function fetchSparkline(label: QuoteLabel, points = 30): Promise<number[]> {
  const cfg = TD_SYMBOLS[label]
  const pts = await getTimeseriesRaw(cfg.symbol, '1day', points)
  return pts.map((p) => p.close)
}

/**
 * Sparkline arbitrário por símbolo.
 */
export async function fetchSparklineBySymbol(symbol: string, points = 30): Promise<number[]> {
  const pts = await getTimeseriesRaw(symbol, '1day', points)
  return pts.map((p) => p.close)
}

/**
 * Quote arbitrário por símbolo (uso em watchlist).
 */
export async function fetchQuoteBySymbol(symbol: string): Promise<TwelveDataQuote | null> {
  return getQuoteRaw(symbol)
}

/**
 * Histórico para gráfico grande. Cache 1h.
 */
export async function fetchHistorico(
  symbol: string,
  periodo: '1d' | '1s' | '1m' | '6m' | '1a' | 'tudo',
): Promise<TimeseriesPoint[]> {
  const cfg: Record<typeof periodo, { interval: string; outputsize: number }> = {
    '1d': { interval: '15min', outputsize: 32 },     // 1 dia em janelas de 15min
    '1s': { interval: '1h',    outputsize: 56 },      // 1 semana em horas
    '1m': { interval: '1day',  outputsize: 30 },
    '6m': { interval: '1day',  outputsize: 180 },
    '1a': { interval: '1day',  outputsize: 365 },
    'tudo': { interval: '1week', outputsize: 260 },   // 5 anos em semanas
  }
  const c = cfg[periodo]
  return getTimeseriesRaw(symbol, c.interval, c.outputsize)
}
