/**
 * esr-client.ts
 * Cliente da API USDA FAS ESR (Export Sales Reporting).
 *
 * Fonte oficial das vendas/embarques semanais de exportação dos EUA por país.
 * Endpoint base: https://api.fas.usda.gov/api/esr/
 * Auth: header 'X-Api-Key: <chave>' (process.env.USDA_API_KEY) — a mesma chave
 * usada pelo psd-client.ts (PSD e ESR compartilham host e credencial).
 *
 * Princípios (idênticos ao psd-client):
 *  - NUNCA lança: em qualquer erro retorna null/[] e loga (degradação graciosa).
 *  - Cache in-memory com TTL ~6h: o ESR é atualizado ~1x/semana (quinta-feira),
 *    então não há motivo para bater na API com frequência.
 *  - Integração best-effort com lib/quotes/rate-budget.ts (fonte 'usda'). Se a
 *    importação/uso falhar, é ignorado silenciosamente — o fluxo de dados nunca
 *    pode ser travado pela contabilidade de orçamento.
 *
 * Unidades: ESR de grãos vem em "1000 MT" (mil toneladas, unitId 1). Os valores
 * são reportados como números inteiros em mil toneladas.
 *
 * Estrutura da API:
 *  - /esr/commodities → catálogo de commodities {commodityCode, commodityName}.
 *  - /esr/exports/commodityCode/{code}/allCountries/marketYear/{ano} → registros
 *    semanais por país (countryCode numérico; mapear nome via /esr/countries).
 *  - /esr/countries → mapeamento countryCode (int) → countryName.
 */

const API_BASE = 'https://api.fas.usda.gov/api/esr'

/**
 * Códigos de commodity ESR validados ao vivo na API (/esr/commodities).
 * Soybeans = 801, Corn = 401.
 */
export const ESR_CODES = {
  soja: 801, // Soybeans
  milho: 401, // Corn
} as const

export type EsrRegistro = {
  commodityCode: number
  countryCode?: string
  countryName?: string
  weekEndingDate?: string
  weeklyExports?: number
  accumulatedExports?: number
  outstandingSales?: number
  grossNewSales?: number
  currentMYNetSales?: number
  currentMYTotalCommitment?: number
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
 * Faz GET autenticado na API ESR. NUNCA lança: em erro retorna null e loga.
 * Aplica cache in-memory por caminho (TTL 6h) e registra consulta no budget.
 */
async function buscarJson<T>(caminho: string): Promise<T | null> {
  if (!temChave()) {
    console.warn('[esr] USDA_API_KEY ausente — pulando consulta:', caminho)
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
      console.warn(`[esr] HTTP ${resp.status} em ${caminho}`)
      return null
    }

    const json = (await resp.json()) as T
    gravarCache(caminho, json)
    return json
  } catch (err) {
    console.warn('[esr] falha ao consultar', caminho, err)
    return null
  }
}

// ── Helpers de normalização ─────────────────────────────────────────────────

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return 0
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : String(v ?? '').trim()
}

// ── Mapeamento de países (countryCode int → nome) ───────────────────────────

/**
 * Carrega o mapa countryCode → countryName de /esr/countries (com cache).
 * Em erro retorna mapa vazio — o consumidor simplesmente fica sem o nome.
 */
async function mapaPaises(): Promise<Map<string, string>> {
  const raw = await buscarJson<unknown>('/countries')
  const mapa = new Map<string, string>()
  if (!Array.isArray(raw)) return mapa
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const code = str(r.countryCode)
    if (!code) continue
    // countryName é o nome curto; countryDescription pode ser usado como fallback.
    const nome = str(r.countryName) || str(r.countryDescription)
    mapa.set(code, nome)
  }
  return mapa
}

// ── API pública ─────────────────────────────────────────────────────────────

/**
 * Lista as commodities disponíveis no ESR. Retorna [] em qualquer erro.
 * Útil para descobrir/auditar os códigos (ex.: Soybeans, Corn).
 */
export async function listarCommodities(): Promise<
  { commodityCode: number; commodityName: string }[]
> {
  const raw = await buscarJson<unknown>('/commodities')
  if (!Array.isArray(raw)) return []
  const out: { commodityCode: number; commodityName: string }[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    out.push({
      commodityCode: num(r.commodityCode),
      commodityName: str(r.commodityName),
    })
  }
  return out
}

/**
 * Busca as vendas/embarques semanais de exportação de uma commodity num
 * ano-safra (market year), por país. Resolve o nome do país via /esr/countries.
 * Retorna [] em qualquer erro.
 * Ex.: exportacoesSemana(ESR_CODES.soja, 2025).
 */
export async function exportacoesSemana(
  commodityCode: number,
  ano: number,
): Promise<EsrRegistro[]> {
  const raw = await buscarJson<unknown>(
    `/exports/commodityCode/${commodityCode}/allCountries/marketYear/${ano}`,
  )
  if (!Array.isArray(raw)) return []

  // Resolve nomes de países (best-effort; mapa vazio se falhar).
  const paises = await mapaPaises()

  const out: EsrRegistro[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const countryCode = str(r.countryCode)
    const reg: EsrRegistro = {
      commodityCode: num(r.commodityCode),
      countryCode: countryCode || undefined,
      countryName: paises.get(countryCode) || undefined,
      weekEndingDate: str(r.weekEndingDate) || undefined,
      weeklyExports: num(r.weeklyExports),
      accumulatedExports: num(r.accumulatedExports),
      outstandingSales: num(r.outstandingSales),
      grossNewSales: num(r.grossNewSales),
      currentMYNetSales: num(r.currentMYNetSales),
      currentMYTotalCommitment: num(r.currentMYTotalCommitment),
    }
    out.push(reg)
  }
  return out
}

/**
 * Consolida o panorama de exportação de um grão num ano-safra:
 *  - commitmentTotal: soma do total comprometido (currentMYTotalCommitment) na
 *    semana mais recente — vendas pendentes + embarques acumulados.
 *  - vendasSemana: soma das novas vendas líquidas (currentMYNetSales) da semana
 *    mais recente.
 *  - principaisDestinos: top destinos por comprometimento total (ex.: China).
 *  - semana: data (ISO) da semana de referência usada.
 *
 * Retorna null se não houver dados. Nunca lança.
 */
export async function resumoExportacao(
  grao: 'soja' | 'milho',
  ano: number,
): Promise<{
  commitmentTotal: number | null
  vendasSemana: number | null
  principaisDestinos: { pais: string; total: number }[]
  semana: string | null
} | null> {
  const code = ESR_CODES[grao]
  const registros = await exportacoesSemana(code, ano)
  if (registros.length === 0) return null

  // Identifica a semana mais recente (maior weekEndingDate parseável).
  let semana: string | null = null
  let semanaTs = Number.NEGATIVE_INFINITY
  for (const r of registros) {
    if (!r.weekEndingDate) continue
    const ts = Date.parse(r.weekEndingDate)
    if (Number.isNaN(ts)) continue
    if (ts > semanaTs) {
      semanaTs = ts
      semana = r.weekEndingDate
    }
  }

  // Filtra os registros da semana de referência (todos os países).
  const daSemana = semana
    ? registros.filter((r) => r.weekEndingDate === semana)
    : registros

  let commitmentTotal = 0
  let vendasSemana = 0
  const porDestino = new Map<string, number>()

  for (const r of daSemana) {
    commitmentTotal += r.currentMYTotalCommitment ?? 0
    vendasSemana += r.currentMYNetSales ?? 0
    const total = r.currentMYTotalCommitment ?? 0
    if (total > 0) {
      const nome = r.countryName || r.countryCode || 'Desconhecido'
      porDestino.set(nome, (porDestino.get(nome) ?? 0) + total)
    }
  }

  const principaisDestinos = Array.from(porDestino.entries())
    .map(([pais, total]) => ({ pais, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  return {
    commitmentTotal: daSemana.length > 0 ? commitmentTotal : null,
    vendasSemana: daSemana.length > 0 ? vendasSemana : null,
    principaisDestinos,
    semana,
  }
}
