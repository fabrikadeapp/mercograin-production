/**
 * psd-client.ts
 * Cliente da API USDA FAS PSD (Production, Supply & Distribution).
 *
 * Fonte oficial dos dados de oferta e demanda mundiais de grãos (WASDE/PSD).
 * Endpoint base: https://api.fas.usda.gov/api/psd/
 * Auth: header 'X-Api-Key: <chave>' (process.env.USDA_API_KEY).
 *
 * Princípios:
 *  - NUNCA lança: em qualquer erro retorna null/[] e loga (degradação graciosa).
 *  - Cache in-memory com TTL ~6h: os dados PSD mudam ~1x/mês (release WASDE),
 *    então não há motivo para bater na API com frequência.
 *  - Integração best-effort com lib/quotes/rate-budget.ts: registra a fonte
 *    'usda'. Se a importação/uso falhar, é ignorado silenciosamente — o
 *    fluxo de dados nunca pode ser travado pela contabilidade de orçamento.
 *
 * Unidades: cada registro tem value em "mil unidades" (unitId 8 = '1000 MT',
 * mil toneladas). Dividir por 1000 para milhões de toneladas (Mt).
 */

const API_BASE = 'https://api.fas.usda.gov/api/psd'

/** Códigos de commodity validados na API PSD. */
export const USDA_CODES = {
  soja: '2222000', // Oilseed, Soybean
  milho: '0440000', // Corn
} as const

/** IDs de atributos PSD validados. value em mil unidades (unitId 8 = 1000 MT). */
export const ATTR = {
  producao: 28, // Production
  estoqueFinal: 176, // Ending Stocks
  produtividade: 184, // Yield
} as const

/** Códigos de país PSD validados. */
export const PAIS = {
  brasil: 'BR',
  argentina: 'AR',
  eua: 'US',
} as const

export type PsdRegistro = {
  commodityCode: string
  countryCode: string
  marketYear: number
  month: number
  attributeId: number
  value: number
  unitId: number
}

// ── Cache in-memory (TTL ~6h) ───────────────────────────────────────────────

const TTL_MS = 6 * 60 * 60 * 1000 // 6 horas

interface EntradaCache<T> {
  dados: T
  em: number // epoch ms da gravação
}

const cache = new Map<string, EntradaCache<unknown>>()

function lerCache<T>(chave: string): T | undefined {
  const e = cache.get(chave)
  if (!e) return undefined
  if (Date.now() - e.em >= TTL_MS) {
    cache.delete(chave)
    return undefined
  }
  return e.dados as T
}

function gravarCache<T>(chave: string, dados: T): void {
  cache.set(chave, { dados, em: Date.now() })
}

// ── Chave da API ────────────────────────────────────────────────────────────

/** Indica se a chave da API USDA está presente no ambiente. */
export function temChave(): boolean {
  const k = process.env.USDA_API_KEY
  return typeof k === 'string' && k.trim().length > 0
}

// ── Integração best-effort com rate-budget (nunca trava o fluxo) ─────────────

const FONTE_BUDGET = 'usda'

/** Registra a consulta no orçamento de requisições, se o módulo existir. */
async function registrarOrcamento(): Promise<void> {
  try {
    const mod = await import('@/lib/quotes/rate-budget')
    if (mod && typeof mod.registrarConsulta === 'function') {
      await mod.registrarConsulta(FONTE_BUDGET)
    }
  } catch {
    // Sem rate-budget disponível — ignorado de propósito.
  }
}

// ── Fetch base ──────────────────────────────────────────────────────────────

/**
 * Faz GET autenticado na API PSD. NUNCA lança: em erro retorna null e loga.
 * Aplica cache in-memory por caminho (TTL 6h) e registra consulta no budget.
 */
async function buscarJson<T>(caminho: string): Promise<T | null> {
  if (!temChave()) {
    console.warn('[usda] USDA_API_KEY ausente — pulando consulta:', caminho)
    return null
  }

  const cacheado = lerCache<T>(caminho)
  if (cacheado !== undefined) return cacheado

  try {
    await registrarOrcamento()

    const url = `${API_BASE}${caminho}`
    const resp = await fetch(url, {
      headers: {
        'X-Api-Key': process.env.USDA_API_KEY as string,
        Accept: 'application/json',
      },
      // Cache HTTP do Next.js: revalida a cada 6h, alinhado ao TTL in-memory.
      next: { revalidate: 21600 },
    })

    if (!resp.ok) {
      console.warn(`[usda] HTTP ${resp.status} em ${caminho}`)
      return null
    }

    const json = (await resp.json()) as T
    gravarCache(caminho, json)
    return json
  } catch (err) {
    console.warn('[usda] falha ao consultar', caminho, err)
    return null
  }
}

// ── Normalização de registros ───────────────────────────────────────────────

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return 0
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : String(v ?? '')
}

/** Converte a resposta crua da API em PsdRegistro[] tolerando ausências. */
function normalizar(raw: unknown): PsdRegistro[] {
  if (!Array.isArray(raw)) return []
  const out: PsdRegistro[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    out.push({
      commodityCode: str(r.commodityCode),
      countryCode: str(r.countryCode),
      marketYear: num(r.marketYear),
      month: num(r.month),
      attributeId: num(r.attributeId),
      value: num(r.value),
      unitId: num(r.unitId),
    })
  }
  return out
}

// ── API pública ─────────────────────────────────────────────────────────────

/**
 * Busca os dados mundiais (agregado "world") de uma commodity num ano-safra.
 * Retorna [] em qualquer erro. Ex.: buscarMundo('2222000', 2026).
 */
export async function buscarMundo(commodityCode: string, ano: number): Promise<PsdRegistro[]> {
  const raw = await buscarJson<unknown>(`/commodity/${commodityCode}/world/year/${ano}`)
  return normalizar(raw)
}

/**
 * Busca os dados de um país específico para uma commodity num ano-safra.
 * Retorna [] em qualquer erro. Ex.: buscarPais('2222000', 'BR', 2026).
 */
export async function buscarPais(
  commodityCode: string,
  countryCode: string,
  ano: number,
): Promise<PsdRegistro[]> {
  const raw = await buscarJson<unknown>(`/commodity/${commodityCode}/country/${countryCode}/year/${ano}`)
  return normalizar(raw)
}

/**
 * Retorna a data do release mais recente (string ISO) de uma commodity, ou null.
 * A API expõe /commodity/{code}/dataReleaseDates; pegamos a maior data.
 */
export async function ultimaDataRelease(commodityCode: string): Promise<string | null> {
  const raw = await buscarJson<unknown>(`/commodity/${commodityCode}/dataReleaseDates`)
  if (!Array.isArray(raw) || raw.length === 0) return null

  let maior: string | null = null
  let maiorTs = Number.NEGATIVE_INFINITY

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    // O campo de data pode variar (releaseDate/dataReleaseDate/date); tenta todos.
    const dataStr =
      str(r.releaseDate) || str(r.dataReleaseDate) || str(r.date) || str(r.releaseTimestamp)
    if (!dataStr) continue
    const ts = Date.parse(dataStr)
    if (Number.isNaN(ts)) continue
    if (ts > maiorTs) {
      maiorTs = ts
      maior = dataStr
    }
  }

  return maior
}
