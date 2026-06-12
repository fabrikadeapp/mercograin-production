/**
 * Cliente de term-structure / carry CBOT (estrutura a termo dos futuros).
 *
 * Base acadêmica (term-structure/carry, Wisconsin): basis/carry é sazonalmente
 * previsível; o spread entre o contrato front e um deferido sinaliza o incentivo
 * a estocar. Mercado em CARRY (deferido > front) = bem suprido / baixista no
 * curto prazo; mercado INVERTIDO (backwardation, deferido < front) = aperto de
 * oferta / altista.
 *
 * carryAtual usa Yahoo Finance (front ZS=F/ZC=F + um deferido ~6 meses à frente),
 * pois o histórico mensal de carry é inviável (contratos expiram). Para o BACKTEST
 * usamos carrySazonalEstimado — uma aproximação do carry típico por mês calendário,
 * derivada do padrão sazonal (colheita = carry largo; entressafra = estreito/invertido).
 *
 * Padrão best-effort (modelo lib/quotes/bcb.ts e series-client.ts):
 *   cache TTL · timeout · NUNCA lança · fallback p/ cache stale ou null.
 */

export type Grao = 'soja' | 'milho'

export type CarryPonto = {
  front: number
  deferido: number
  /** (deferido - front) / front. Positivo = carry; negativo = invertido. */
  carryPct: number
}

const TTL = 6 * 60 * 60 * 1000 // 6h — estrutura a termo muda no máximo 1x/dia
const TIMEOUT_MS = 12_000
const UA = 'Mozilla/5.0 (compatible; MercograinBot/1.0)'

interface CacheEntry {
  data: CarryPonto | null
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

// ── Símbolos dos contratos deferidos (~6 meses à frente do front) ────────────
//
// Yahoo identifica futuros CBOT específicos por mês/ano: <raiz><cod-mes><AA>.CBT.
// Códigos de mês CME: F=jan H=mar K=mai N=jul Q=ago U=set X=nov Z=dez.
// Escolhemos um deferido líquido ~6m à frente:
//   soja  (ZS): contrato X (novembro) — safra nova, ~6m após o front típico
//   milho (ZC): contrato Z (dezembro) — safra nova, deferido líquido
// O ano é resolvido dinamicamente (próxima ocorrência do mês-alvo). Caímos para
// uma lista de candidatos (ano corrente e seguinte) e usamos o 1º que responder.
const FRONT_SYMBOL: Record<Grao, string> = {
  soja: 'ZS=F',
  milho: 'ZC=F',
}
const DEFERIDO_RAIZ: Record<Grao, string> = {
  soja: 'ZS',
  milho: 'ZC',
}
const DEFERIDO_MES_COD: Record<Grao, string> = {
  soja: 'X', // novembro
  milho: 'Z', // dezembro
}

/** Último close válido de uma série Yahoo chart 1mo. null se indisponível. */
async function ultimoClose(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol,
    )}?interval=1mo&range=1y`
    const r = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': UA },
    })
    if (!r.ok) return null
    const j = (await r.json()) as {
      chart?: {
        result?: Array<{
          meta?: { regularMarketPrice?: unknown }
          indicators?: { quote?: Array<{ close?: (number | null)[] }> }
        }>
      }
    }
    const res = j.chart?.result?.[0]
    // Preferir o preço de mercado do meta (mais atual); senão último close.
    const meta = num(res?.meta?.regularMarketPrice)
    if (meta !== null && meta > 0) return meta
    const closes = res?.indicators?.quote?.[0]?.close || []
    for (let i = closes.length - 1; i >= 0; i--) {
      const v = num(closes[i])
      if (v !== null && v > 0) return v
    }
    return null
  } catch {
    return null
  }
}

/** Gera os símbolos candidatos do deferido (ano corrente e seguinte). */
function candidatosDeferido(grao: Grao): string[] {
  const raiz = DEFERIDO_RAIZ[grao]
  const cod = DEFERIDO_MES_COD[grao]
  const anoAtual = new Date().getFullYear()
  const out: string[] = []
  for (const ano of [anoAtual, anoAtual + 1, anoAtual + 2]) {
    const aa = String(ano % 100).padStart(2, '0')
    out.push(`${raiz}${cod}${aa}.CBT`)
  }
  return out
}

/**
 * Term-structure atual: front (ZS=F/ZC=F) vs um deferido (~6m à frente).
 * carryPct = (deferido - front) / front. Best-effort, NUNCA lança.
 * Retorna null se qualquer perna ficar indisponível.
 */
export async function carryAtual(grao: Grao): Promise<CarryPonto | null> {
  const cacheKey = `carry:${grao}`
  const now = Date.now()
  const cached = cache.get(cacheKey)
  if (cached && now - cached.at < TTL) return cached.data

  try {
    const front = await ultimoClose(FRONT_SYMBOL[grao])
    if (front === null || front <= 0) return cached?.data ?? null

    let deferido: number | null = null
    for (const sym of candidatosDeferido(grao)) {
      deferido = await ultimoClose(sym)
      if (deferido !== null && deferido > 0) break
    }
    if (deferido === null || deferido <= 0) return cached?.data ?? null

    const carryPct = (deferido - front) / front
    const ponto: CarryPonto = { front, deferido, carryPct }
    cache.set(cacheKey, { data: ponto, at: now })
    return ponto
  } catch (e: any) {
    console.warn(`[termo-client] carryAtual ${grao} falhou:`, e?.message || e)
    return cached?.data ?? null
  }
}

// ── Funções PURAS (testáveis sem rede) ───────────────────────────────────────

/**
 * Classifica o carry. FUNÇÃO PURA.
 *
 * Interpretação econômica:
 *   carry positivo alto  → mercado bem suprido, incentivo a estocar (baixista CP)
 *   carry leve positivo  → suprimento normal
 *   invertido (deferido < front, backwardation) → aperto de oferta (altista)
 *
 * Limiares em fração (1% = 0.01):
 *   >  +2%  → 'forte_carry'
 *   0..+2%  → 'leve_carry'
 *   < 0     → 'invertido'
 */
export function classificarCarry(carryPct: number): 'forte_carry' | 'leve_carry' | 'invertido' {
  if (!Number.isFinite(carryPct)) return 'leve_carry'
  if (carryPct < 0) return 'invertido'
  if (carryPct > 0.02) return 'forte_carry'
  return 'leve_carry'
}

/**
 * Estimativa do carry típico por mês calendário (fração). FUNÇÃO PURA.
 *
 * A literatura (basis/carry sazonal) diz que o carry é largo na COLHEITA (oferta
 * abundante, mercado paga para estocar) e estreito/invertido na ENTRESSAFRA
 * (oferta apertada antes da safra nova). Modelamos esse padrão por hemisfério:
 *
 *   Soja  — colheita US set–nov (carry largo); aperto pré-safra jun–jul.
 *   Milho — colheita US set–nov; aperto pré-safra jun–ago.
 *
 * Valores plausíveis em fração, centrados perto de zero. Aproximação determinística
 * para alimentar o backtest (não substitui o carry ao vivo de carryAtual).
 */
export function carrySazonalEstimado(mes: number, grao: Grao): number {
  // Sanitiza o mês para 1..12.
  const m = Number.isFinite(mes) ? ((Math.trunc(mes) - 1) % 12 + 12) % 12 + 1 : 1

  // Perfis por mês (índice 0 = janeiro). Positivo = carry; negativo = invertido.
  // Colheita US (set–nov) → carry largo; pré-safra (jun–ago) → estreito/invertido.
  const PERFIL: Record<Grao, number[]> = {
    // jan   fev   mar   abr   mai   jun   jul   ago   set   out   nov   dez
    soja: [
      0.010, 0.008, 0.005, 0.002, 0.000, -0.005, -0.008, -0.003, 0.012, 0.018, 0.015, 0.012,
    ],
    milho: [
      0.012, 0.010, 0.007, 0.003, 0.000, -0.004, -0.010, -0.006, 0.012, 0.024, 0.018, 0.014,
    ],
  }

  return PERFIL[grao][m - 1]
}
