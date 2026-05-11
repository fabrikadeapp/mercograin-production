/**
 * Interface unificada para providers de cotação.
 *
 * Cada provider implementa este contrato. O registry escolhe o provider
 * primário (definido em SystemConfig 'quotes.providers') e cai em fallbacks
 * em caso de falha.
 *
 * Símbolos abstratos (QuoteLabel) ↔ símbolos do provider são mapeados
 * internamente em cada provider.
 */

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

export interface TimeseriesPoint {
  datetime: string
  close: number
}

export type ProviderId = 'twelvedata' | 'yahoo' | 'bcb' | 'cepea'

export interface QuotesConfig {
  primary: ProviderId
  fallbacks: ProviderId[]
  cacheMinutes: number
}

export const DEFAULT_QUOTES_CONFIG: QuotesConfig = {
  primary: 'twelvedata',
  fallbacks: ['yahoo', 'cepea'],
  cacheMinutes: 5,
}

export interface QuoteProvider {
  /** Identificador estável para SystemConfig. */
  readonly id: ProviderId
  /** Nome legível para UI. */
  readonly displayName: string
  /**
   * Quais labels este provider sabe responder.
   *
   * BCB só responde 'usdbrl'. CEPEA só grãos. Twelve/Yahoo respondem tudo.
   * O registry usa isto para escolher fallback correto.
   */
  readonly supports: readonly QuoteLabel[]

  /** Indica se a config básica (chave de API, host, etc.) está presente. */
  isConfigured(): boolean

  /** Busca uma cotação. Retorna null se falhar ou label não suportado. */
  getQuote(label: QuoteLabel): Promise<LiveQuote | null>

  /** Health check leve — chamado pela UI super-admin. */
  ping(): Promise<{ ok: boolean; message?: string; latencyMs?: number }>
}
