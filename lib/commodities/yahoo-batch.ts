/**
 * Yahoo Finance batch helpers para o widget de commodities.
 *
 * - getQuotesBatch: snapshot atual de N símbolos (1 round-trip via quoteCombine).
 * - getPerformance: cálculo de variação 1d/1w/1m/YTD/1y/3y a partir de historical
 *   (1 chamada de historical por símbolo, paralelas). Cache em memória 10 min.
 * - getDailyCloses: closes diários N dias (sparkline + technical).
 *
 * yahoo-finance2 v3 exige instanciar a classe.
 */
import YahooFinance from 'yahoo-finance2'

const yf = new (YahooFinance as unknown as new (opts?: any) => any)({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
})

export interface CommodityQuote {
  symbol: string
  price: number | null
  open: number | null
  high: number | null
  low: number | null
  previousClose: number | null
  changeAbs: number | null
  changePct: number | null
  currency: string | null
  exchangeName: string | null
  marketState: string | null
  /** Contract month / expiry display (ex.: 'Jul 26'). */
  contractMonth: string | null
  /** Timestamp da última cotação. */
  regularMarketTime: number | null
  fetchedAt: string
}

export interface PerformanceData {
  daily: number | null    // %
  week1: number | null
  month1: number | null
  ytd: number | null
  year1: number | null
  year3: number | null
}

const QUOTE_TTL_MS = 30_000 // 30s — balanceia frescor com carga do servidor
const PERF_TTL_MS = 10 * 60_000 // 10 min (performance é histórico, não muda em 10s)
const HIST_TTL_MS = 10 * 60_000

const quoteCache = new Map<string, { data: CommodityQuote; at: number }>()
const perfCache = new Map<string, { data: PerformanceData; at: number }>()
const histCache = new Map<string, { closes: number[]; at: number }>()

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function formatContractMonth(epochSeconds: number | null | undefined): string | null {
  if (!epochSeconds || epochSeconds <= 0) return null
  const d = new Date(epochSeconds * 1000)
  if (Number.isNaN(d.getTime())) return null
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

function formatContractFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

/**
 * Snapshot atual em batch. Yahoo aceita lista de símbolos no quote() —
 * mas o tipo é union; tratamos como any.
 */
export async function getQuotesBatch(symbols: string[]): Promise<Record<string, CommodityQuote | null>> {
  const now = Date.now()
  const result: Record<string, CommodityQuote | null> = {}
  const toFetch: string[] = []

  for (const s of symbols) {
    const cached = quoteCache.get(s)
    if (cached && now - cached.at < QUOTE_TTL_MS) {
      result[s] = cached.data
    } else {
      toFetch.push(s)
    }
  }
  if (toFetch.length === 0) return result

  try {
    const raw = (await yf.quote(toFetch)) as any
    const rows: any[] = Array.isArray(raw) ? raw : [raw]
    for (const q of rows) {
      const sym: string = q?.symbol ?? ''
      if (!sym) continue
      const cq: CommodityQuote = {
        symbol: sym,
        price: num(q.regularMarketPrice),
        open: num(q.regularMarketOpen),
        high: num(q.regularMarketDayHigh),
        low: num(q.regularMarketDayLow),
        previousClose: num(q.regularMarketPreviousClose),
        changeAbs: num(q.regularMarketChange),
        changePct: num(q.regularMarketChangePercent),
        currency: typeof q.currency === 'string' ? q.currency : null,
        exchangeName: typeof q.fullExchangeName === 'string' ? q.fullExchangeName : null,
        marketState: typeof q.marketState === 'string' ? q.marketState : null,
        contractMonth:
          formatContractFromIso(q.expireIsoDate ?? q.expireDate ?? null) ??
          formatContractMonth(q.contractSymbolExpireDate ?? null),
        regularMarketTime: num(q.regularMarketTime),
        fetchedAt: new Date(now).toISOString(),
      }
      quoteCache.set(sym, { data: cq, at: now })
      result[sym] = cq
    }
  } catch (e: any) {
    console.warn('[yahoo-batch] quote falhou:', e?.message || e)
  }

  // Símbolos pedidos mas que Yahoo não respondeu
  for (const s of toFetch) {
    if (!(s in result)) result[s] = null
  }
  return result
}

/**
 * Histórico diário N dias atrás. Cache 10 min.
 * Retorna closes em ordem cronológica ascendente.
 */
async function getDailyCloses(symbol: string, daysBack: number): Promise<number[]> {
  const now = Date.now()
  const cacheKey = `${symbol}:${daysBack}`
  const cached = histCache.get(cacheKey)
  if (cached && now - cached.at < HIST_TTL_MS) return cached.closes

  const period2 = new Date(now)
  const period1 = new Date(now - daysBack * 24 * 60 * 60 * 1000)
  try {
    const rows = (await yf.historical(symbol, {
      period1,
      period2,
      interval: '1d',
    })) as Array<{ close?: number | null; date?: Date }>
    const closes = rows
      .map((r) => (typeof r.close === 'number' && Number.isFinite(r.close) ? r.close : null))
      .filter((x): x is number => x !== null)
    histCache.set(cacheKey, { closes, at: now })
    return closes
  } catch (e: any) {
    console.warn(`[yahoo-batch] historical(${symbol}, ${daysBack}d) falhou:`, e?.message || e)
    return []
  }
}

export async function getDailyClosesPublic(symbol: string, daysBack = 90): Promise<number[]> {
  return getDailyCloses(symbol, daysBack)
}

/**
 * Variações de performance baseadas em closes históricos.
 * Cache 10 min por símbolo.
 */
export async function getPerformance(symbol: string): Promise<PerformanceData> {
  const now = Date.now()
  const cached = perfCache.get(symbol)
  if (cached && now - cached.at < PERF_TTL_MS) return cached.data

  // 3 anos cobre todas as janelas. Yahoo limita histórico, mas commodities têm full history.
  const closes = await getDailyCloses(symbol, 3 * 365 + 30)
  if (closes.length < 2) {
    const empty: PerformanceData = {
      daily: null, week1: null, month1: null, ytd: null, year1: null, year3: null,
    }
    return empty
  }

  const last = closes[closes.length - 1]
  function pct(from: number | undefined): number | null {
    if (typeof from !== 'number' || from === 0) return null
    return ((last - from) / from) * 100
  }

  // Aproximações por dias úteis (≈ índice negativo na lista)
  const daily = pct(closes[closes.length - 2])
  const week1 = pct(closes[closes.length - 6]) // ~5 pregões
  const month1 = pct(closes[closes.length - 22]) // ~21 pregões
  const year1 = pct(closes[closes.length - 252])
  const year3 = pct(closes[closes.length - 252 * 3])

  // YTD: primeiro close do ano corrente
  const nowDate = new Date()
  // historical retornou closes só; sem datas explicit. Estimamos por offset: ~(month*21 + day/1.4)
  // Em vez de aproximar, fazemos uma segunda passada pegando close mais antigo do ano.
  let ytd: number | null = null
  try {
    const yearStart = new Date(nowDate.getFullYear(), 0, 1)
    const rows = (await yf.historical(symbol, {
      period1: yearStart,
      period2: new Date(yearStart.getFullYear(), 0, 31),
      interval: '1d',
    })) as Array<{ close?: number }>
    const firstClose = rows.find((r) => typeof r.close === 'number')?.close
    if (typeof firstClose === 'number') ytd = pct(firstClose)
  } catch {
    /* mantém null */
  }

  const data: PerformanceData = { daily, week1, month1, ytd, year1, year3 }
  perfCache.set(symbol, { data, at: now })
  return data
}
