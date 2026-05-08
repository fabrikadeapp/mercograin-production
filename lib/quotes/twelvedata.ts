/**
 * Twelve Data live quotes for PHB Grain.
 *
 * Symbols:
 *   SOYB     - Teucrium Soybean Fund (ETF proxy de soja CBOT) — USD
 *   CORN     - Teucrium Corn Fund    (ETF proxy de milho CBOT) — USD
 *   WEAT     - Teucrium Wheat Fund   (ETF proxy de trigo CBOT) — USD
 *   USD/BRL  - Câmbio dólar comercial — BRL
 *
 * NOTA: O free tier do Twelve Data não cobre futuros CBOT (ZS=F/ZC=F/ZW=F).
 * Usamos os ETFs Teucrium (SOYB/CORN/WEAT) que são tradicionalmente os melhores
 * proxies acessíveis dos futuros — correlacionam ~0.95 com o ativo subjacente.
 * O usuário vê preço em USD/cota do ETF; UX rotula adequadamente.
 *
 * 800 req/dia · 8 req/min no free tier (mais que suficiente para 4 símbolos
 * com cache de 30s no edge).
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
  marketState: string | null  // "open" | "closed" | null
  fetchedAt: string
}

interface SymbolConfig {
  symbol: string       // o que o Twelve Data conhece
  displayName: string  // o que aparece no front
  currency: string
  fallbackCurrency: string
}

export const TD_SYMBOLS: Record<QuoteLabel, SymbolConfig> = {
  soja:   { symbol: 'SOYB',    displayName: 'SOYB · NYSE', currency: 'USD', fallbackCurrency: 'USD' },
  milho:  { symbol: 'CORN',    displayName: 'CORN · NYSE', currency: 'USD', fallbackCurrency: 'USD' },
  trigo:  { symbol: 'WEAT',    displayName: 'WEAT · NYSE', currency: 'USD', fallbackCurrency: 'USD' },
  usdbrl: { symbol: 'USD/BRL', displayName: 'USD/BRL',     currency: 'BRL', fallbackCurrency: 'BRL' },
}

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
  if (errMsg) {
    console.warn(`[twelvedata] ${label} (${cfg.symbol}) failed: ${errMsg}`)
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
    currency: cfg.fallbackCurrency,
    exchangeName: null,
    marketState: null,
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

export async function fetchLiveQuote(label: QuoteLabel): Promise<LiveQuote> {
  const cfg = TD_SYMBOLS[label]
  if (!API_KEY) return emptyQuote(label, 'TWELVEDATA_API_KEY não configurada')

  try {
    const url = `${API_BASE}/quote?symbol=${encodeURIComponent(cfg.symbol)}&apikey=${API_KEY}`
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!r.ok) return emptyQuote(label, `HTTP ${r.status}`)
    const q = (await r.json()) as TwelveDataQuote

    if (q.status === 'error' || q.code) {
      return emptyQuote(label, q.message || `code ${q.code}`)
    }

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
  } catch (e: any) {
    return emptyQuote(label, e?.message || String(e))
  }
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

/**
 * Time series para sparkline (últimos 30 dias, intervalo diário).
 * Endpoint: /time_series · 800 req/dia free tier compartilhado.
 */
export async function fetchSparkline(label: QuoteLabel, points = 30): Promise<number[]> {
  const cfg = TD_SYMBOLS[label]
  if (!API_KEY) return []
  try {
    const url = `${API_BASE}/time_series?symbol=${encodeURIComponent(cfg.symbol)}&interval=1day&outputsize=${points}&apikey=${API_KEY}`
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!r.ok) return []
    const j = (await r.json()) as { values?: Array<{ close: string }>, status?: string }
    if (!j.values) return []
    // Twelve Data retorna mais recente primeiro; reverte para ordem cronológica.
    return j.values.map((v) => Number(v.close)).filter(Number.isFinite).reverse()
  } catch (e: any) {
    console.warn(`[twelvedata] sparkline ${label} failed:`, e?.message || e)
    return []
  }
}
