/**
 * Boletim Focus — Banco Central do Brasil (BCB).
 * Expectativas de mercado coletadas semanalmente (publicação às segundas).
 * API pública OData, SEM chave.
 *
 * Endpoint base:
 *   https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativaMercadoMensais
 *
 * Campos por ponto:
 *   { Indicador, Data (data da coleta), DataReferencia (mês alvo 'MM/AAAA'),
 *     Media, Mediana, DesvioPadrao, Minimo, Maximo, numeroRespondentes, baseCalculo }
 *
 * Indicadores úteis: 'Câmbio' (dólar projetado), 'Selic', 'IPCA'.
 * A CURVA de dólar futuro = projeção do indicador 'Câmbio' para cada mês de
 * referência futuro (uma DataReferencia por mês). best-effort, NUNCA lança.
 */

export type FocusIndicador = 'Câmbio' | 'Selic' | 'IPCA'

export interface FocusPonto {
  indicador: string
  dataColeta: string      // data da coleta (Data) — 'AAAA-MM-DD'
  mesReferencia: string   // mês alvo (DataReferencia) — 'MM/AAAA'
  media: number
  mediana: number
  minimo: number
  maximo: number
  desvioPadrao: number
  respondentes: number
}

const FOCUS_BASE =
  'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativaMercadoMensais'

const TTL = 6 * 60 * 60_000 // 6h — Focus atualiza semanalmente (segunda)

interface CacheEntry {
  data: FocusPonto[]
  at: number
}
const cache = new Map<string, CacheEntry>()

/** Resposta crua da API OData. */
interface FocusRaw {
  Indicador?: string
  Data?: string
  DataReferencia?: string
  Media?: unknown
  Mediana?: unknown
  Minimo?: unknown
  Maximo?: unknown
  DesvioPadrao?: unknown
  numeroRespondentes?: unknown
  baseCalculo?: unknown
}

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    // Olinda devolve número em string com ponto decimal.
    const x = Number(v)
    return Number.isFinite(x) ? x : 0
  }
  return 0
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/**
 * Monta a URL OData para um indicador, ordenada por Data desc (coletas mais
 * recentes primeiro). Usa encodeURIComponent no valor do filtro para escapar
 * acentos (Câmbio → C%C3%A2mbio) e o espaço do `eq`.
 */
export function buildUrl(indicador: string, top: number): string {
  const filtro = `Indicador eq '${indicador}'`
  const params = [
    `$top=${top}`,
    `$filter=${encodeURIComponent(filtro)}`,
    `$orderby=${encodeURIComponent('Data desc')}`,
    '$format=json',
  ]
  return `${FOCUS_BASE}?${params.join('&')}`
}

/** Mapeia um registro cru da API para FocusPonto. */
function mapPonto(raw: FocusRaw): FocusPonto {
  // Data vem como 'AAAA-MM-DD' (ou ISO) — normaliza pegando só a parte da data.
  const dataColeta = str(raw.Data).slice(0, 10)
  return {
    indicador: str(raw.Indicador),
    dataColeta,
    mesReferencia: str(raw.DataReferencia),
    media: num(raw.Media),
    mediana: num(raw.Mediana),
    minimo: num(raw.Minimo),
    maximo: num(raw.Maximo),
    desvioPadrao: num(raw.DesvioPadrao),
    respondentes: num(raw.numeroRespondentes),
  }
}

/**
 * Compara mesReferencia 'MM/AAAA' como chave ordenável 'AAAAMM'.
 * Entrada inválida → '000000' (vai para o início).
 */
function chaveMes(mesReferencia: string): string {
  const m = /^(\d{2})\/(\d{4})$/.exec(mesReferencia)
  if (!m) return '000000'
  return `${m[2]}${m[1]}`
}

/**
 * Função pura: dedup + ordenação da curva.
 * Para cada mesReferencia mantém apenas a coleta MAIS RECENTE (maior dataColeta).
 * Retorna ordenado por mesReferencia ASC (cronológico).
 */
export function dedupCurva(pontos: FocusPonto[]): FocusPonto[] {
  const porMes = new Map<string, FocusPonto>()
  for (const p of pontos) {
    if (!p.mesReferencia) continue
    const existente = porMes.get(p.mesReferencia)
    // dataColeta 'AAAA-MM-DD' é lexicograficamente ordenável.
    if (!existente || p.dataColeta > existente.dataColeta) {
      porMes.set(p.mesReferencia, p)
    }
  }
  return Array.from(porMes.values()).sort((a, b) =>
    chaveMes(a.mesReferencia).localeCompare(chaveMes(b.mesReferencia)),
  )
}

/** Fetch genérico de uma série mensal do Focus. best-effort. */
async function fetchSerie(indicador: string, top: number): Promise<FocusPonto[]> {
  const chaveCache = `${indicador}|${top}`
  const now = Date.now()
  const cached = cache.get(chaveCache)
  if (cached && now - cached.at < TTL) return cached.data

  try {
    const url = buildUrl(indicador, top)
    const r = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
    })
    if (!r.ok) {
      if (cached) return cached.data
      return []
    }
    const j = (await r.json()) as { value?: FocusRaw[] }
    const itens = Array.isArray(j.value) ? j.value : []
    const pontos = itens.map(mapPonto).filter((p) => p.mesReferencia)
    cache.set(chaveCache, { data: pontos, at: now })
    return pontos
  } catch (e: any) {
    console.warn(`[focus] ${indicador} falhou:`, e?.message || e)
    if (cached) return cached.data
    return []
  }
}

/**
 * Últimas projeções mensais de um indicador (Câmbio/Selic/IPCA), já mapeadas.
 * Ordem: coletas mais recentes primeiro (Data desc), conforme a API.
 */
export async function expectativaMensal(
  indicador: FocusIndicador,
  limite = 100,
): Promise<FocusPonto[]> {
  return fetchSerie(indicador, limite)
}

/**
 * Curva de dólar futuro projetada pelo mercado (indicador 'Câmbio').
 * Para cada mês de referência futuro pega a coleta mais recente, deduplica e
 * ordena por mesReferencia ASC. ESSENCIAL.
 */
export async function curvaDolarFuturo(): Promise<FocusPonto[]> {
  // top alto: várias coletas × vários meses de referência. dedupCurva colapsa.
  const pontos = await fetchSerie('Câmbio', 500)
  const curva = dedupCurva(pontos)
  // Mantém só meses >= mês corrente (curva futura).
  const agora = new Date()
  const chaveAtual = `${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, '0')}`
  return curva.filter((p) => chaveMes(p.mesReferencia) >= chaveAtual)
}

/**
 * Atalho: projeção do dólar para o próximo mês e para dezembro do ano corrente
 * (fim de ano). Retorna null se a curva vier vazia.
 */
export async function dolarProjetado(): Promise<{
  proximoMes: FocusPonto | null
  fimAno: FocusPonto | null
} | null> {
  const curva = await curvaDolarFuturo()
  if (curva.length === 0) return null

  const agora = new Date()
  const ano = agora.getFullYear()
  const mesAtual = agora.getMonth() + 1 // 1..12

  // Próximo mês (corrente +1), com rollover de ano.
  const proxMesNum = mesAtual === 12 ? 1 : mesAtual + 1
  const proxAno = mesAtual === 12 ? ano + 1 : ano
  const refProximo = `${String(proxMesNum).padStart(2, '0')}/${proxAno}`
  const refFimAno = `12/${ano}`

  const proximoMes =
    curva.find((p) => p.mesReferencia === refProximo) ?? curva[0] ?? null
  const fimAno = curva.find((p) => p.mesReferencia === refFimAno) ?? null

  return { proximoMes, fimAno }
}
