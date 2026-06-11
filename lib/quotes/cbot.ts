/**
 * Futuros CBOT (Chicago Board of Trade) em centavos de dólar por bushel.
 *
 * Fonte: Yahoo Finance chart API — pública, sem chave, retorna o contrato
 * front-month de cada grão com `currency: "USX"` (US cents) e `exchange: CBT`.
 *
 *   ZS=F → Soja   (ex.: 1123,5 ¢/bu = US$ 11,235/bu)
 *   ZC=F → Milho  (ex.:  419,75 ¢/bu)
 *   ZW=F → Trigo  (ex.:  588,0 ¢/bu)
 *
 * Diferente da Twelve Data (que no plano atual NÃO cobre futuros agrícolas —
 * o símbolo `ZS` lá resolve para a ação Zscaler), o Yahoo entrega o futuro
 * CBOT real. Usado para alimentar o Simulador CBOT com o preço de Chicago.
 */

export type GraoCbot = 'soja' | 'milho' | 'trigo'

const SYMBOL: Record<GraoCbot, string> = {
  soja: 'ZS=F',
  milho: 'ZC=F',
  trigo: 'ZW=F',
}

export interface CbotQuote {
  /** Preço do futuro front-month em centavos de dólar por bushel (US¢/bu). */
  centsPerBushel: number | null
  /** Símbolo Yahoo (ZS=F etc). */
  symbol: string
  fetchedAt: string
}

interface CacheEntry {
  data: CbotQuote
  at: number
}
const TTL = 5 * 60_000 // 5 min — futuro intradiário, 5min evita martelar a fonte
const cache = new Map<GraoCbot, CacheEntry>()

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const x = Number(v)
    return Number.isFinite(x) ? x : null
  }
  return null
}

/**
 * Busca o futuro CBOT de um grão em ¢/bu. Best-effort: em caso de falha
 * retorna `centsPerBushel: null` (ou cache stale, se houver).
 */
export async function fetchCbotQuote(grao: GraoCbot): Promise<CbotQuote> {
  const now = Date.now()
  const sym = SYMBOL[grao]
  const cached = cache.get(grao)
  if (cached && now - cached.at < TTL) return cached.data

  const fetchedAt = new Date(now).toISOString()
  const empty: CbotQuote = { centsPerBushel: null, symbol: sym, fetchedAt }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      sym,
    )}?interval=1d&range=1d`
    const r = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MercograinBot/1.0)' },
    })
    if (!r.ok) {
      if (cached) return cached.data
      return empty
    }
    const j = (await r.json()) as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: unknown; currency?: string } }> }
    }
    const meta = j.chart?.result?.[0]?.meta
    const price = num(meta?.regularMarketPrice)
    // Yahoo devolve USX (US cents) para esses contratos — o preço já está em ¢/bu.
    const result: CbotQuote = { centsPerBushel: price, symbol: sym, fetchedAt }
    cache.set(grao, { data: result, at: now })
    return result
  } catch (e: any) {
    console.warn(`[cbot] ${grao} (${sym}) falhou:`, e?.message || e)
    if (cached) return cached.data
    return empty
  }
}

/** Busca os três grãos em paralelo. */
export async function fetchCbotQuotes(): Promise<Record<GraoCbot, number | null>> {
  const [soja, milho, trigo] = await Promise.all([
    fetchCbotQuote('soja'),
    fetchCbotQuote('milho'),
    fetchCbotQuote('trigo'),
  ])
  return {
    soja: soja.centsPerBushel,
    milho: milho.centsPerBushel,
    trigo: trigo.centsPerBushel,
  }
}
