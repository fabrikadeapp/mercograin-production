/**
 * Cliente do histórico COT (Commitments of Traders) da CFTC para o backtest.
 *
 * Fonte: CFTC public reporting (Socrata) — dataset 72hh-3qpy, sem chave.
 *   Disaggregated Futures-Only Combined: posição "managed money" (fundos
 *   trend-following). Semanal. net = longs - shorts.
 *
 * Base acadêmica (UC Davis): managed money NÃO prevê retorno isolado; serve
 * como sinal de EXTREMO/confirmação — posição muito esticada (|z| alto) indica
 * risco de reversão. Por isso expomos `zScoreNet` para normalizar a série.
 *
 * Padrão best-effort (modelo lib/quotes/bcb.ts e series-client.ts):
 *   cache TTL ~6h · timeout · NUNCA lança · fallback p/ cache stale ou [].
 *
 * `cotHistorico` retorna CotPonto[] ASCENDENTE por data.
 * `agregarMensal` e `zScoreNet` são FUNÇÕES PURAS (testáveis sem rede).
 */

export type Grao = 'soja' | 'milho'

/** Um ponto semanal do COT. mes em 1-12. */
export type CotPonto = {
  data: string // YYYY-MM-DD
  ano: number
  mes: number
  netManagedMoney: number // longs - shorts
  longs: number
  shorts: number
}

/** Nome da commodity no dataset CFTC por grão. */
const COMMODITY: Record<Grao, string> = {
  soja: 'SOYBEANS',
  milho: 'CORN',
}

const CFTC_BASE = 'https://publicreporting.cftc.gov/resource/72hh-3qpy.json'
const TTL = 6 * 60 * 60 * 1000 // 6h — COT é divulgado semanalmente (sextas)
const TIMEOUT_MS = 12_000
const UA = 'Mozilla/5.0 (compatible; MercograinBot/1.0)'

interface CacheEntry {
  data: CotPonto[]
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
 * Extrai {ano, mes} de uma data ISO YYYY-MM-DD lendo os componentes da string
 * (NÃO usa `new Date()` para evitar deslocamento de fuso). Retorna null se o
 * formato não casar ou o mês for inválido.
 */
function parseData(s: string): { ano: number; mes: number } | null {
  if (typeof s !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  const ano = Number(m[1])
  const mes = Number(m[2])
  if (!Number.isFinite(ano) || !Number.isFinite(mes) || mes < 1 || mes > 12) return null
  return { ano, mes }
}

/**
 * Mensaliza o COT semanal: média do `net` por (ano, mes). FUNÇÃO PURA.
 *
 * O COT é semanal; o backtest opera em base mensal. Tiramos a MÉDIA do net das
 * semanas dentro de cada mês. Resultado ASCENDENTE por (ano, mes).
 */
export function agregarMensal(pontos: CotPonto[]): { ano: number; mes: number; net: number }[] {
  const chave = (ano: number, mes: number) => ano * 12 + (mes - 1)
  const acc = new Map<number, { ano: number; mes: number; soma: number; n: number }>()

  for (const p of pontos) {
    if (!p || !Number.isFinite(p.ano) || !Number.isFinite(p.mes)) continue
    if (!Number.isFinite(p.netManagedMoney)) continue
    const k = chave(p.ano, p.mes)
    const atual = acc.get(k)
    if (atual) {
      atual.soma += p.netManagedMoney
      atual.n += 1
    } else {
      acc.set(k, { ano: p.ano, mes: p.mes, soma: p.netManagedMoney, n: 1 })
    }
  }

  return [...acc.values()]
    .map(({ ano, mes, soma, n }) => ({ ano, mes, net: soma / n }))
    .sort((a, b) => chave(a.ano, a.mes) - chave(b.ano, b.mes))
}

/**
 * Normaliza a série de net em z-scores (média 0, desvio 1). FUNÇÃO PURA.
 *
 * Extremos (|z| > 1.5) indicam posição esticada → risco de reversão. Se a série
 * for vazia retorna []; se o desvio-padrão for 0 (todos iguais) retorna zeros.
 * Usa desvio-padrão populacional (divisor N).
 */
export function zScoreNet(serieNet: number[]): number[] {
  const validos = serieNet.filter((v) => Number.isFinite(v))
  if (validos.length === 0) return serieNet.map(() => 0)

  const media = validos.reduce((a, b) => a + b, 0) / validos.length
  const variancia =
    validos.reduce((a, b) => a + (b - media) * (b - media), 0) / validos.length
  const desvio = Math.sqrt(variancia)
  if (desvio === 0) return serieNet.map(() => 0)

  return serieNet.map((v) => (Number.isFinite(v) ? (v - media) / desvio : 0))
}

// ── Fetcher best-effort ──────────────────────────────────────────────────────

/**
 * Histórico COT (managed money) semanal do grão desde `desdeAno` (default 2021).
 *
 * Fonte CFTC 72hh-3qpy. Filtra linhas com long=0 E short=0 (mini-contrato
 * duplicado sem dado). net = longs - shorts. Ordena ASCENDENTE por data.
 * Best-effort: nunca lança; em falha devolve cache stale ou [].
 */
export async function cotHistorico(grao: Grao, desdeAno = 2021): Promise<CotPonto[]> {
  const commodity = COMMODITY[grao]
  const cacheKey = `cot:${commodity}:${desdeAno}`
  const now = Date.now()
  const cached = cache.get(cacheKey)
  if (cached && now - cached.at < TTL) return cached.data

  try {
    // $where com aspas/espaços precisa ser URL-encoded.
    const where =
      `commodity_name='${commodity}' AND ` +
      `report_date_as_yyyy_mm_dd>'${desdeAno - 1}-12-31'`
    const select =
      'report_date_as_yyyy_mm_dd,m_money_positions_long_all,m_money_positions_short_all'
    const url =
      `${CFTC_BASE}?$where=${encodeURIComponent(where)}` +
      `&$select=${encodeURIComponent(select)}` +
      `&$order=${encodeURIComponent('report_date_as_yyyy_mm_dd DESC')}` +
      `&$limit=2000`

    const r = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': UA },
    })
    if (!r.ok) return cached?.data ?? []

    const linhas = (await r.json()) as Array<{
      report_date_as_yyyy_mm_dd?: string
      m_money_positions_long_all?: unknown
      m_money_positions_short_all?: unknown
    }>

    const pontos: CotPonto[] = []
    for (const linha of linhas) {
      const longs = num(linha.m_money_positions_long_all)
      const shorts = num(linha.m_money_positions_short_all)
      if (longs === null || shorts === null) continue
      // Mini-contrato duplicado sem dado: long=0 E short=0 → descarta.
      if (longs === 0 && shorts === 0) continue
      const ad = linha.report_date_as_yyyy_mm_dd
        ? parseData(linha.report_date_as_yyyy_mm_dd)
        : null
      if (!ad) continue
      // A data vem como ISO completo (ex.: '2024-05-07T00:00:00.000'); normaliza
      // para YYYY-MM-DD.
      const data = String(linha.report_date_as_yyyy_mm_dd).slice(0, 10)
      pontos.push({
        data,
        ano: ad.ano,
        mes: ad.mes,
        netManagedMoney: longs - shorts,
        longs,
        shorts,
      })
    }
    // A query veio DESC — ordena ASCENDENTE por data no cliente.
    pontos.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))

    cache.set(cacheKey, { data: pontos, at: now })
    return pontos
  } catch (e: any) {
    console.warn(`[cot-client] cotHistorico ${grao} (${commodity}) falhou:`, e?.message || e)
    return cached?.data ?? []
  }
}
