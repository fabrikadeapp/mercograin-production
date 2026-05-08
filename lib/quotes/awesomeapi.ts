/**
 * AwesomeAPI — câmbio brasileiro com bid/ask reais.
 * Endpoint público, sem chave, sem rate limit notável.
 * Fonte: https://economia.awesomeapi.com.br/
 */

export interface FxBidAsk {
  pair: string         // 'USD/BRL'
  bid: number | null
  ask: number | null
  high: number | null
  low: number | null
  varBid: number | null
  pctChange: number | null
  spread: number | null     // ask - bid
  spreadPct: number | null  // (ask-bid)/bid * 100
  timestamp: string | null  // ISO
  source: string            // 'awesomeapi'
  fetchedAt: string
}

interface CacheEntry { data: FxBidAsk | null; at: number }
const TTL = 30_000  // 30s
const cache = new Map<string, CacheEntry>()

function n(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') { const x = Number(v); return Number.isFinite(x) ? x : null }
  return null
}

/**
 * Busca bid/ask de um par via AwesomeAPI.
 * @param code Ex: 'USD-BRL', 'EUR-BRL'
 */
export async function fetchFxBidAsk(code: string = 'USD-BRL'): Promise<FxBidAsk> {
  const now = Date.now()
  const cached = cache.get(code)
  if (cached?.data && now - cached.at < TTL) return cached.data

  const fetchedAt = new Date(now).toISOString()
  const empty: FxBidAsk = {
    pair: code.replace('-', '/'),
    bid: null, ask: null, high: null, low: null,
    varBid: null, pctChange: null,
    spread: null, spreadPct: null,
    timestamp: null,
    source: 'awesomeapi',
    fetchedAt,
  }

  try {
    const r = await fetch(`https://economia.awesomeapi.com.br/last/${code}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) {
      // serve stale se houver
      if (cached?.data) return cached.data
      return empty
    }
    const j = await r.json() as Record<string, any>
    const key = code.replace('-', '')
    const q = j[key]
    if (!q) return cached?.data || empty

    const bid = n(q.bid)
    const ask = n(q.ask)
    const spread = bid !== null && ask !== null ? ask - bid : null
    const spreadPct = spread !== null && bid !== null && bid > 0 ? (spread / bid) * 100 : null

    const result: FxBidAsk = {
      pair: code.replace('-', '/'),
      bid,
      ask,
      high: n(q.high),
      low: n(q.low),
      varBid: n(q.varBid),
      pctChange: n(q.pctChange),
      spread,
      spreadPct,
      timestamp: q.timestamp ? new Date(Number(q.timestamp) * 1000).toISOString() : null,
      source: 'awesomeapi',
      fetchedAt,
    }
    cache.set(code, { data: result, at: now })
    return result
  } catch (e: any) {
    console.warn(`[awesomeapi] ${code} failed:`, e?.message || e)
    return cached?.data || empty
  }
}
