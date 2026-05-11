/**
 * Adaptador QuoteProvider para CEPEA/ESALQ.
 * Cotações spot brasileiras de soja, milho, trigo em R$/sc 60kg.
 */
import type { LiveQuote, QuoteLabel, QuoteProvider } from '../types'
import { fetchCepeaQuote, type CepeaLabel } from '../cepea'

const GRAIN_LABELS = new Set<QuoteLabel>(['soja', 'milho', 'trigo'])

export const cepeaProvider: QuoteProvider = {
  id: 'cepea',
  displayName: 'CEPEA/ESALQ',
  supports: ['soja', 'milho', 'trigo'],

  isConfigured() {
    return true
  },

  async getQuote(label: QuoteLabel): Promise<LiveQuote | null> {
    if (!GRAIN_LABELS.has(label)) return null
    try {
      const q = await fetchCepeaQuote(label as CepeaLabel)
      if (q.precoSc60 === null) return null
      return {
        symbol: q.displayName,
        label,
        price: q.precoSc60,
        open: null,
        high: null,
        low: null,
        previousClose: null,
        changeAbs: null,
        changePct: null,
        currency: 'BRL',
        exchangeName: 'CEPEA/ESALQ',
        marketState: null,
        fetchedAt: q.fetchedAt,
      }
    } catch {
      return null
    }
  },

  async ping() {
    const t = Date.now()
    const q = await this.getQuote('soja')
    return q
      ? { ok: true, latencyMs: Date.now() - t }
      : { ok: false, message: 'falha ao raspar página CEPEA' }
  },
}
