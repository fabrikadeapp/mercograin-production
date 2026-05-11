/**
 * Adaptador QuoteProvider para Twelve Data.
 * Wrapper sobre as funções já existentes em lib/quotes/twelvedata.ts.
 */
import type { LiveQuote, QuoteLabel, QuoteProvider } from '../types'
import { fetchLiveQuote } from '../twelvedata'

export const twelvedataProvider: QuoteProvider = {
  id: 'twelvedata',
  displayName: 'Twelve Data',
  supports: ['soja', 'milho', 'trigo', 'usdbrl'],

  isConfigured() {
    return Boolean(process.env.TWELVEDATA_API_KEY)
  },

  async getQuote(label: QuoteLabel): Promise<LiveQuote | null> {
    if (!this.isConfigured()) return null
    try {
      const q = await fetchLiveQuote(label)
      // fetchLiveQuote sempre retorna o objeto (com price null se falhou);
      // tratamos price null como "não obteve cotação" para permitir fallback.
      if (q.price === null) return null
      return q
    } catch {
      return null
    }
  },

  async ping() {
    if (!this.isConfigured()) {
      return { ok: false, message: 'TWELVEDATA_API_KEY não configurada' }
    }
    const t = Date.now()
    const q = await this.getQuote('usdbrl')
    return q
      ? { ok: true, latencyMs: Date.now() - t }
      : { ok: false, message: 'sem resposta (rate limit ou indisponível)' }
  },
}
