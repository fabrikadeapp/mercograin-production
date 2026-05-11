/**
 * Adaptador QuoteProvider para Yahoo Finance (via yahoo-finance2).
 *
 * Símbolos:
 *   ZS=F   — Soja CBOT (continuous front month), USc/bu
 *   ZC=F   — Milho CBOT, USc/bu
 *   ZW=F   — Trigo CBOT, USc/bu
 *   USDBRL=X — Dólar comercial USD/BRL
 *
 * Yahoo é não-oficial mas funciona bem e é gratuito. Sem chave.
 */
import type { LiveQuote, QuoteLabel, QuoteProvider } from '../types'
import YahooFinance from 'yahoo-finance2'

// Singleton — yahoo-finance2 v3 exige instanciar a classe.
// `suppressNotices` silencia o banner de "survey" no startup.
const yf = new (YahooFinance as unknown as new (opts?: any) => any)({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
})

const SYMBOLS: Record<QuoteLabel, { symbol: string; currency: string }> = {
  soja: { symbol: 'ZS=F', currency: 'USD' },
  milho: { symbol: 'ZC=F', currency: 'USD' },
  trigo: { symbol: 'ZW=F', currency: 'USD' },
  usdbrl: { symbol: 'USDBRL=X', currency: 'BRL' },
}

const TTL_MS = 60_000
type CacheEntry = { data: LiveQuote | null; at: number }
const cache = new Map<string, CacheEntry>()

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export const yahooProvider: QuoteProvider = {
  id: 'yahoo',
  displayName: 'Yahoo Finance',
  supports: ['soja', 'milho', 'trigo', 'usdbrl'],

  isConfigured() {
    return true
  },

  async getQuote(label: QuoteLabel): Promise<LiveQuote | null> {
    const cfg = SYMBOLS[label]
    if (!cfg) return null

    const now = Date.now()
    const cached = cache.get(label)
    if (cached && now - cached.at < TTL_MS) return cached.data

    try {
      const q = (await yf.quote(cfg.symbol)) as Record<string, any>

      const price = typeof q?.regularMarketPrice === 'number' ? q.regularMarketPrice : null
      const result: LiveQuote | null =
        price === null
          ? null
          : {
              symbol: cfg.symbol,
              label,
              price,
              open: numOrNull(q.regularMarketOpen),
              high: numOrNull(q.regularMarketDayHigh),
              low: numOrNull(q.regularMarketDayLow),
              previousClose: numOrNull(q.regularMarketPreviousClose),
              changeAbs: numOrNull(q.regularMarketChange),
              changePct: numOrNull(q.regularMarketChangePercent),
              currency: typeof q.currency === 'string' ? q.currency : cfg.currency,
              exchangeName: typeof q.fullExchangeName === 'string' ? q.fullExchangeName : null,
              marketState: typeof q.marketState === 'string' ? q.marketState : null,
              fetchedAt: new Date(now).toISOString(),
            }

      cache.set(label, { data: result, at: now })
      return result
    } catch (e: any) {
      console.warn(`[yahoo] ${label} (${cfg.symbol}) falhou:`, e?.message || e)
      return null
    }
  },

  async ping() {
    const t = Date.now()
    const q = await this.getQuote('usdbrl')
    return q
      ? { ok: true, latencyMs: Date.now() - t }
      : { ok: false, message: 'sem resposta do Yahoo Finance' }
  },
}
