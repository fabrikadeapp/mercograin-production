/**
 * Adaptador QuoteProvider para BCB (PTAX USD/BRL).
 * Só responde 'usdbrl' — fica como fallback dedicado de câmbio.
 */
import type { LiveQuote, QuoteLabel, QuoteProvider } from '../types'
import { fetchBcbDolar } from '../bcb'

export const bcbProvider: QuoteProvider = {
  id: 'bcb',
  displayName: 'Banco Central (PTAX)',
  supports: ['usdbrl'],

  isConfigured() {
    return true // API pública sem chave
  },

  async getQuote(label: QuoteLabel): Promise<LiveQuote | null> {
    if (label !== 'usdbrl') return null
    try {
      const q = await fetchBcbDolar()
      const mid =
        q.cotacaoCompra && q.cotacaoVenda ? (q.cotacaoCompra + q.cotacaoVenda) / 2 : null
      if (mid === null) return null
      return {
        symbol: 'USD/BRL',
        label: 'usdbrl',
        price: mid,
        open: null,
        high: q.cotacaoVenda,
        low: q.cotacaoCompra,
        previousClose: null,
        changeAbs: null,
        changePct: null,
        currency: 'BRL',
        exchangeName: 'BCB',
        marketState: null,
        fetchedAt: q.fetchedAt,
      }
    } catch {
      return null
    }
  },

  async ping() {
    const t = Date.now()
    const q = await this.getQuote('usdbrl')
    return q
      ? { ok: true, latencyMs: Date.now() - t }
      : { ok: false, message: 'sem resposta do olinda.bcb.gov.br' }
  },
}
