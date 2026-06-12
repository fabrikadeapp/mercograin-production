/**
 * Cliente das séries históricas mensais usadas pelo backtest da inteligência.
 *
 * Reúne as três fontes históricas validadas ao vivo:
 *   1. Preço físico BR (IPEAData / DERAL-SEAB-PR) — a SÉRIE GABARITO em R$/saca60.
 *   2. CBOT mensal (Yahoo Finance) — preço internacional em ¢/bushel.
 *   3. Câmbio mensal (BCB SGS série 1) — dólar comercial venda, fim de mês.
 *
 * Padrão best-effort (modelo lib/quotes/bcb.ts e cbot.ts):
 *   cache TTL ~12h · timeout · NUNCA lança · fallback p/ cache stale ou [].
 *
 * Cada série retorna PontoMensal[] ASCENDENTE por (ano, mês).
 */

export type Grao = 'soja' | 'milho'

/** Um ponto de série mensal. mes em 1-12. */
export type PontoMensal = { ano: number; mes: number; valor: number }

/** Códigos das séries de preço físico no IPEAData (SEAB-PR/DERAL, R$/saca60). */
export const IPEA_CODES: Record<Grao, string> = {
  soja: 'DERAL12_PRSO12',
  milho: 'DERAL12_PRMI12',
}

/** Símbolos Yahoo dos futuros CBOT front-month. */
const CBOT_SYMBOL: Record<Grao, string> = {
  soja: 'ZS=F',
  milho: 'ZC=F',
}

const TTL = 12 * 60 * 60 * 1000 // 12h — séries históricas mudam no máximo 1x/dia
const TIMEOUT_MS = 12_000
const UA = 'Mozilla/5.0 (compatible; MercograinBot/1.0)'

interface CacheEntry {
  data: PontoMensal[]
  at: number
}
const cache = new Map<string, CacheEntry>()

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const x = Number(v)
    return Number.isFinite(x) ? x : null
  }
  return null
}

// ── Funções PURAS (testáveis sem rede) ──────────────────────────────────────

/**
 * Extrai {ano, mes} de um VALDATA do IPEAData (ISO com offset de fuso, ex.:
 * '2026-05-01T00:00:00-03:00'). Lê os componentes diretamente da string —
 * NÃO usa `new Date()` para evitar deslocamento de fuso (o dia 01 viraria 30
 * do mês anterior em UTC). Retorna null se o formato não casar.
 */
export function parseValData(s: string): { ano: number; mes: number } | null {
  if (typeof s !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  const ano = Number(m[1])
  const mes = Number(m[2])
  if (!Number.isFinite(ano) || !Number.isFinite(mes) || mes < 1 || mes > 12) return null
  return { ano, mes }
}

/** Converte timestamp Yahoo (segundos, UTC) em {ano, mes} usando UTC. */
function tsParaAnoMes(ts: number): { ano: number; mes: number } {
  const d = new Date(ts * 1000)
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 }
}

/** Converte data BCB 'dd/mm/aaaa' em {ano, mes, dia}. */
function parseDataBcb(s: string): { ano: number; mes: number; dia: number } | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s)
  if (!m) return null
  return { dia: Number(m[1]), mes: Number(m[2]), ano: Number(m[3]) }
}

export type LinhaAlinhada = { ano: number; mes: number; valores: (number | null)[] }

/**
 * Junta N séries mensais por (ano, mes) numa tabela alinhada. FUNÇÃO PURA.
 *
 * Para cada (ano, mes) presente em qualquer série, emite uma linha com o array
 * `valores` na mesma ordem das séries passadas; posições sem dado ficam null.
 * Resultado ASCENDENTE por (ano, mes). Pontos duplicados na mesma série mantêm
 * o ÚLTIMO valor (consistente com agregação fim-de-mês).
 */
export function alinharPorMes(...series: PontoMensal[][]): LinhaAlinhada[] {
  const n = series.length
  const chave = (ano: number, mes: number) => ano * 12 + (mes - 1)
  const mapa = new Map<number, LinhaAlinhada>()

  for (let i = 0; i < n; i++) {
    for (const p of series[i]) {
      if (!p || !Number.isFinite(p.ano) || !Number.isFinite(p.mes)) continue
      const k = chave(p.ano, p.mes)
      let linha = mapa.get(k)
      if (!linha) {
        linha = { ano: p.ano, mes: p.mes, valores: new Array(n).fill(null) }
        mapa.set(k, linha)
      }
      linha.valores[i] = Number.isFinite(p.valor) ? p.valor : null
    }
  }

  return [...mapa.values()].sort((a, b) => chave(a.ano, a.mes) - chave(b.ano, b.mes))
}

// ── Fetchers best-effort ─────────────────────────────────────────────────────

/**
 * Preço físico BR mensal (R$/saca60) — SÉRIE GABARITO do backtest.
 * Fonte IPEAData (DERAL/SEAB-PR), JSON OData público sem chave.
 * Filtra VALVALOR>1 (valores <1 são pré-Real, em cruzeiro), ordena asc por data.
 */
export async function precoFisicoBR(grao: Grao): Promise<PontoMensal[]> {
  const code = IPEA_CODES[grao]
  const cacheKey = `ipea:${code}`
  const now = Date.now()
  const cached = cache.get(cacheKey)
  if (cached && now - cached.at < TTL) return cached.data

  try {
    const url = `http://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='${code}')`
    const r = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!r.ok) return cached?.data ?? []
    const j = (await r.json()) as { value?: Array<{ VALDATA?: string; VALVALOR?: unknown }> }
    const linhas = j.value || []

    const pontos: PontoMensal[] = []
    for (const item of linhas) {
      const valor = num(item.VALVALOR)
      // <=1 é pré-Real (cruzeiro) — descarta.
      if (valor === null || valor <= 1) continue
      const ad = item.VALDATA ? parseValData(item.VALDATA) : null
      if (!ad) continue
      pontos.push({ ano: ad.ano, mes: ad.mes, valor })
    }
    // A API ignora $orderby — ordena no cliente (asc por ano, mes).
    pontos.sort((a, b) => a.ano - b.ano || a.mes - b.mes)

    cache.set(cacheKey, { data: pontos, at: now })
    return pontos
  } catch (e: any) {
    console.warn(`[series-client] precoFisicoBR ${grao} (${code}) falhou:`, e?.message || e)
    return cached?.data ?? []
  }
}

/**
 * CBOT mensal (¢/bushel) — futuro front-month, últimos 5 anos.
 * Fonte Yahoo Finance (ZS=F/ZC=F), interval=1mo range=5y. User-Agent obrigatório.
 */
export async function cbotMensal(grao: Grao): Promise<PontoMensal[]> {
  const sym = CBOT_SYMBOL[grao]
  const cacheKey = `cbot:${sym}`
  const now = Date.now()
  const cached = cache.get(cacheKey)
  if (cached && now - cached.at < TTL) return cached.data

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      sym,
    )}?interval=1mo&range=5y`
    const r = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': UA },
    })
    if (!r.ok) return cached?.data ?? []
    const j = (await r.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[]
          indicators?: { quote?: Array<{ close?: (number | null)[] }> }
        }>
      }
    }
    const res = j.chart?.result?.[0]
    const ts = res?.timestamp || []
    const closes = res?.indicators?.quote?.[0]?.close || []

    const pontos: PontoMensal[] = []
    for (let i = 0; i < ts.length; i++) {
      const valor = num(closes[i])
      if (valor === null) continue
      const { ano, mes } = tsParaAnoMes(ts[i])
      pontos.push({ ano, mes, valor })
    }
    pontos.sort((a, b) => a.ano - b.ano || a.mes - b.mes)

    cache.set(cacheKey, { data: pontos, at: now })
    return pontos
  } catch (e: any) {
    console.warn(`[series-client] cbotMensal ${grao} (${sym}) falhou:`, e?.message || e)
    return cached?.data ?? []
  }
}

/**
 * Câmbio mensal (R$/US$) do anoInicial até hoje — dólar comercial venda.
 * Fonte BCB SGS série 1 (diário). Agrega para o ÚLTIMO valor de cada mês.
 */
export async function cambioMensal(anoInicial: number): Promise<PontoMensal[]> {
  const hoje = new Date()
  const anoFinal = hoje.getFullYear()
  const cacheKey = `bcb:1:${anoInicial}:${anoFinal}:${hoje.getMonth() + 1}`
  const now = Date.now()
  const cached = cache.get(cacheKey)
  if (cached && now - cached.at < TTL) return cached.data

  try {
    const dataInicial = `01/01/${anoInicial}`
    const dd = String(hoje.getDate()).padStart(2, '0')
    const mm = String(hoje.getMonth() + 1).padStart(2, '0')
    const dataFinal = `${dd}/${mm}/${anoFinal}`
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados?formato=json&dataInicial=${dataInicial}&dataFinal=${dataFinal}`
    const r = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!r.ok) return cached?.data ?? []
    const linhas = (await r.json()) as Array<{ data?: string; valor?: unknown }>

    // Agrega para o último valor de cada (ano, mes). A série é diária e
    // ascendente, mas comparamos o dia para garantir o "fim de mês" real.
    const porMes = new Map<number, { ano: number; mes: number; dia: number; valor: number }>()
    for (const linha of linhas) {
      const valor = num(linha.valor)
      const d = linha.data ? parseDataBcb(linha.data) : null
      if (valor === null || !d) continue
      const k = d.ano * 12 + (d.mes - 1)
      const atual = porMes.get(k)
      if (!atual || d.dia >= atual.dia) {
        porMes.set(k, { ano: d.ano, mes: d.mes, dia: d.dia, valor })
      }
    }

    const pontos: PontoMensal[] = [...porMes.values()]
      .map(({ ano, mes, valor }) => ({ ano, mes, valor }))
      .sort((a, b) => a.ano - b.ano || a.mes - b.mes)

    cache.set(cacheKey, { data: pontos, at: now })
    return pontos
  } catch (e: any) {
    console.warn(`[series-client] cambioMensal desde ${anoInicial} falhou:`, e?.message || e)
    return cached?.data ?? []
  }
}
