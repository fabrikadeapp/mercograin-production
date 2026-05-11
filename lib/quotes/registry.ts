/**
 * Registry de providers de cotação + resolução com fallback.
 *
 * Fluxo:
 *   1. Lê SystemConfig 'quotes.providers' (primary, fallbacks, cacheMinutes)
 *   2. Cacheia config em memória por 30s (evita query por chamada)
 *   3. getQuote(label) tenta primary; em null/erro, tenta fallbacks em ordem
 *   4. Se nenhum responder, retorna null (consumer decide se mostra "—" ou erro)
 *
 * Para listar/testar providers (UI super-admin) use listProviders().
 */
import { db } from '@/lib/db'
import type {
  LiveQuote,
  ProviderId,
  QuoteLabel,
  QuoteProvider,
  QuotesConfig,
} from './types'
import { DEFAULT_QUOTES_CONFIG } from './types'
import { twelvedataProvider } from './providers/twelvedata'
import { yahooProvider } from './providers/yahoo'
import { bcbProvider } from './providers/bcb'
import { cepeaProvider } from './providers/cepea'

const PROVIDERS: Record<ProviderId, QuoteProvider> = {
  twelvedata: twelvedataProvider,
  yahoo: yahooProvider,
  bcb: bcbProvider,
  cepea: cepeaProvider,
}

const CONFIG_KEY = 'quotes.providers'
const CONFIG_CACHE_MS = 30_000
let configCache: { data: QuotesConfig; at: number } | null = null

export function listProviders(): QuoteProvider[] {
  return Object.values(PROVIDERS)
}

export function getProviderById(id: ProviderId): QuoteProvider | null {
  return PROVIDERS[id] ?? null
}

/**
 * Lê config atual. Em caso de erro de DB, retorna defaults para não derrubar
 * o sistema (cotação é não-crítico no caminho de request).
 */
export async function getQuotesConfig(): Promise<QuotesConfig> {
  const now = Date.now()
  if (configCache && now - configCache.at < CONFIG_CACHE_MS) {
    return configCache.data
  }
  try {
    const row = await db.systemConfig.findUnique({ where: { key: CONFIG_KEY } })
    if (!row) {
      configCache = { data: DEFAULT_QUOTES_CONFIG, at: now }
      return DEFAULT_QUOTES_CONFIG
    }
    const parsed = normalizeConfig(row.value)
    configCache = { data: parsed, at: now }
    return parsed
  } catch (e) {
    console.warn('[quotes/registry] erro lendo SystemConfig, usando default:', e)
    return DEFAULT_QUOTES_CONFIG
  }
}

export async function setQuotesConfig(
  next: QuotesConfig,
  updatedBy?: string,
): Promise<void> {
  const clean = normalizeConfig(next)
  await db.systemConfig.upsert({
    where: { key: CONFIG_KEY },
    create: { key: CONFIG_KEY, value: clean as unknown as object, updatedBy },
    update: { value: clean as unknown as object, updatedBy },
  })
  configCache = { data: clean, at: Date.now() }
}

function normalizeConfig(v: unknown): QuotesConfig {
  const obj = (v ?? {}) as Partial<QuotesConfig>
  const validIds = Object.keys(PROVIDERS) as ProviderId[]
  const primary = validIds.includes(obj.primary as ProviderId)
    ? (obj.primary as ProviderId)
    : DEFAULT_QUOTES_CONFIG.primary
  const fallbacks = Array.isArray(obj.fallbacks)
    ? obj.fallbacks.filter((x): x is ProviderId => validIds.includes(x as ProviderId))
    : DEFAULT_QUOTES_CONFIG.fallbacks
  const cacheMinutes =
    typeof obj.cacheMinutes === 'number' && obj.cacheMinutes >= 0
      ? obj.cacheMinutes
      : DEFAULT_QUOTES_CONFIG.cacheMinutes
  return { primary, fallbacks, cacheMinutes }
}

/**
 * Resolve uma cotação tentando primary → fallbacks. Retorna { quote, source }.
 * Provider que não suporta o label é pulado automaticamente (não conta como falha).
 */
export async function getQuote(
  label: QuoteLabel,
): Promise<{ quote: LiveQuote; source: ProviderId } | null> {
  const cfg = await getQuotesConfig()
  const order: ProviderId[] = [cfg.primary, ...cfg.fallbacks.filter((p) => p !== cfg.primary)]

  for (const id of order) {
    const provider = PROVIDERS[id]
    if (!provider) continue
    if (!provider.supports.includes(label)) continue
    const q = await provider.getQuote(label)
    if (q) return { quote: q, source: id }
  }
  return null
}

/**
 * Pega todas as labels suportadas no MVP em paralelo.
 * Útil para o endpoint /api/cotacoes/live e o agente AI.
 */
export async function getAllQuotes(): Promise<Record<QuoteLabel, LiveQuote | null>> {
  const labels: QuoteLabel[] = ['soja', 'milho', 'trigo', 'usdbrl']
  const results = await Promise.all(
    labels.map(async (label) => [label, await getQuote(label)] as const),
  )
  const out = {} as Record<QuoteLabel, LiveQuote | null>
  for (const [label, res] of results) {
    out[label] = res?.quote ?? null
  }
  return out
}
