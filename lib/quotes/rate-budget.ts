/**
 * rate-budget.ts
 * Controlador de orçamento de requisições a APIs externas de cotações.
 *
 * Objetivo: nunca estourar os limites das APIs gratuitas. Operamos com teto de
 * 80% (pct padrão) dos limites por dia e por minuto, deixando margem de
 * segurança. Quando o teto é atingido, a degradação é graciosa: o chamador
 * deve servir cache em vez de bater na API — NUNCA travar nem lançar.
 *
 * Twelve Data free = 800 req/dia e 8 req/min → a 80% usamos no máx 640/dia e 6/min.
 *
 * Persistência: Redis (best-effort) com fallback in-memory. Toda interação com
 * Redis é envolta em try/catch e jamais propaga erro — em qualquer falha o
 * sistema "abre o portão" (permite consultar) e apenas loga, pois preferimos
 * uma consulta extra a derrubar o fluxo de cotações.
 */

import { redis } from '@/lib/redis'

// ── Configuração de orçamento por fonte ─────────────────────────────────────

export interface BudgetConfig {
  /** Identificador da fonte (ex.: 'twelvedata') */
  fonte: string
  /** Limite real de requisições por dia da API */
  perDay: number
  /** Limite real de requisições por minuto da API */
  perMin: number
  /** Fração do limite que nos permitimos usar (default 0.8 = 80%) */
  pct?: number
}

/**
 * Orçamentos conhecidos. Valores "generosos"/"altos" para fontes cujo limite
 * não é o gargalo, apenas para termos contabilidade e um teto de sanidade.
 */
export const BUDGETS: Record<string, BudgetConfig> = {
  // Twelve Data free: 800/dia, 8/min — fonte mais restritiva.
  twelvedata: { fonte: 'twelvedata', perDay: 800, perMin: 8, pct: 0.8 },
  // AwesomeAPI: generoso (sem limite rígido publicado). Teto de sanidade.
  awesomeapi: { fonte: 'awesomeapi', perDay: 3600, perMin: 60, pct: 0.8 },
  // CEPEA: scraping/consulta esporádica — teto alto.
  cepea: { fonte: 'cepea', perDay: 5000, perMin: 120, pct: 0.8 },
  // Yahoo Finance: teto alto.
  yahoo: { fonte: 'yahoo', perDay: 10000, perMin: 200, pct: 0.8 },
  // ── Fontes da inteligência (cron LENTAS de hora em hora) ──────────────────
  // USDA (PSD/ESR): chave gratuita ~1000/dia. Conservador 800/dia, 8/min a 80%
  // → no máx 640/dia e 6/min. Protege a chave (limite real mais sensível).
  usda: { fonte: 'usda', perDay: 800, perMin: 8, pct: 0.8 },
  // BCB Focus (Olinda): API pública generosa. Teto de sanidade.
  focus: { fonte: 'focus', perDay: 3000, perMin: 60, pct: 0.8 },
  // CONAB: download de CSV esporádico — teto alto.
  conab: { fonte: 'conab', perDay: 3000, perMin: 60, pct: 0.8 },
  // COT (CFTC/histórico): consulta esporádica — teto alto.
  cot: { fonte: 'cot', perDay: 3000, perMin: 60, pct: 0.8 },
}

const PCT_PADRAO = 0.8

// ── Fallback in-memory ──────────────────────────────────────────────────────

interface ContadorMemoria {
  valor: number
  /** epoch ms em que o contador expira (e deve ser resetado) */
  expiraEm: number
}

const memoriaContadores = new Map<string, ContadorMemoria>()

function memoriaGet(chave: string): number {
  const c = memoriaContadores.get(chave)
  if (!c) return 0
  if (Date.now() >= c.expiraEm) {
    memoriaContadores.delete(chave)
    return 0
  }
  return c.valor
}

function memoriaIncr(chave: string, ttlSeg: number): number {
  const agora = Date.now()
  const c = memoriaContadores.get(chave)
  if (!c || agora >= c.expiraEm) {
    const novo = { valor: 1, expiraEm: agora + ttlSeg * 1000 }
    memoriaContadores.set(chave, novo)
    return 1
  }
  c.valor += 1
  return c.valor
}

// ── Chaves Redis (por dia / por minuto, via data/hora do sistema) ───────────

const TTL_DIA_SEG = 86400
const TTL_MIN_SEG = 60

/** Chave do dia: rb:<fonte>:d:AAAA-MM-DD (UTC, estável entre instâncias) */
function chaveDia(fonte: string, agora: Date): string {
  const ano = agora.getUTCFullYear()
  const mes = String(agora.getUTCMonth() + 1).padStart(2, '0')
  const dia = String(agora.getUTCDate()).padStart(2, '0')
  return `rb:${fonte}:d:${ano}-${mes}-${dia}`
}

/** Chave do minuto: rb:<fonte>:m:AAAA-MM-DDTHH:MM (UTC) */
function chaveMin(fonte: string, agora: Date): string {
  const base = chaveDia(fonte, agora).replace(':d:', ':m:')
  const hora = String(agora.getUTCHours()).padStart(2, '0')
  const min = String(agora.getUTCMinutes()).padStart(2, '0')
  return `${base}T${hora}:${min}`
}

// ── Função pura testável ────────────────────────────────────────────────────

/**
 * Indica se o uso atingiu (ou ultrapassou) o teto de pct% do limite.
 * FUNÇÃO PURA — base dos testes unitários.
 *
 * @param usado quantidade já consumida
 * @param teto limite total da janela (ex.: 800/dia)
 * @param pct fração permitida do teto (default 0.8)
 * @returns true se usado >= floor(teto * pct)
 */
export function atingiu80pct(usado: number, teto: number, pct = PCT_PADRAO): boolean {
  if (teto <= 0) return true
  const fracao = pct > 0 ? pct : PCT_PADRAO
  const limiteEfetivo = Math.floor(teto * fracao)
  return usado >= limiteEfetivo
}

// ── Helpers de leitura/escrita de contadores (Redis + fallback) ─────────────

/** Lê um contador (Redis primeiro; cai para memória em erro/ausência). */
async function lerContador(chave: string): Promise<number> {
  try {
    const raw = await redis.get(chave)
    if (raw != null) {
      const n = Number.parseInt(raw, 10)
      if (!Number.isNaN(n)) return n
    }
  } catch (err) {
    console.warn('[rate-budget] Falha ao ler contador, usando memória:', err)
  }
  return memoriaGet(chave)
}

/**
 * Incrementa um contador best-effort no Redis garantindo TTL na criação,
 * e também na memória de fallback. Nunca lança.
 */
async function incrementarContador(chave: string, ttlSeg: number): Promise<void> {
  try {
    const novo = await redis.incr(chave)
    // Define TTL apenas na primeira escrita da janela (evita estender a janela).
    if (novo === 1) {
      await redis.expire(chave, ttlSeg)
    }
  } catch (err) {
    console.warn('[rate-budget] Falha ao incrementar no Redis (best-effort):', err)
  }
  // Sempre mantém a memória coerente (fallback quando Redis está fora).
  memoriaIncr(chave, ttlSeg)
}

function configDaFonte(fonte: string): BudgetConfig {
  return BUDGETS[fonte] ?? { fonte, perDay: Number.MAX_SAFE_INTEGER, perMin: Number.MAX_SAFE_INTEGER, pct: PCT_PADRAO }
}

// ── API pública assíncrona ──────────────────────────────────────────────────

/**
 * Verifica se ainda é permitido consultar a fonte sem estourar o teto de 80%.
 * NUNCA lança: em qualquer erro retorna ok:true (degradação graciosa) e loga.
 */
export async function podeConsultar(
  fonte: string,
): Promise<{ ok: boolean; restanteDia: number; restanteMin: number; motivo?: string }> {
  try {
    const cfg = configDaFonte(fonte)
    const pct = cfg.pct ?? PCT_PADRAO
    const agora = new Date()

    const usadoDia = await lerContador(chaveDia(fonte, agora))
    const usadoMin = await lerContador(chaveMin(fonte, agora))

    const tetoDia = Math.floor(cfg.perDay * pct)
    const tetoMin = Math.floor(cfg.perMin * pct)

    const restanteDia = Math.max(0, tetoDia - usadoDia)
    const restanteMin = Math.max(0, tetoMin - usadoMin)

    const estourouDia = atingiu80pct(usadoDia, cfg.perDay, pct)
    const estourouMin = atingiu80pct(usadoMin, cfg.perMin, pct)

    if (estourouDia) {
      return { ok: false, restanteDia, restanteMin, motivo: `teto diário (${tetoDia}) atingido para ${fonte}` }
    }
    if (estourouMin) {
      return { ok: false, restanteDia, restanteMin, motivo: `teto por minuto (${tetoMin}) atingido para ${fonte}` }
    }
    return { ok: true, restanteDia, restanteMin }
  } catch (err) {
    console.warn('[rate-budget] podeConsultar falhou, liberando por degradação graciosa:', err)
    return { ok: true, restanteDia: 0, restanteMin: 0, motivo: 'erro interno — liberado por fallback' }
  }
}

/**
 * Registra uma consulta efetuada: incrementa contadores de dia e minuto.
 * Best-effort, nunca lança.
 */
export async function registrarConsulta(fonte: string): Promise<void> {
  try {
    const agora = new Date()
    await incrementarContador(chaveDia(fonte, agora), TTL_DIA_SEG)
    await incrementarContador(chaveMin(fonte, agora), TTL_MIN_SEG)
  } catch (err) {
    console.warn('[rate-budget] registrarConsulta falhou (best-effort):', err)
  }
}

/**
 * Retorna o status de orçamento de todas as fontes conhecidas.
 * Best-effort: em erro de leitura individual, conta 0.
 */
export async function statusBudget(): Promise<
  Record<string, { usadoDia: number; tetoDia: number; usadoMin: number; tetoMin: number; pctDia: number }>
> {
  const resultado: Record<
    string,
    { usadoDia: number; tetoDia: number; usadoMin: number; tetoMin: number; pctDia: number }
  > = {}
  const agora = new Date()

  for (const fonte of Object.keys(BUDGETS)) {
    const cfg = BUDGETS[fonte]
    const pct = cfg.pct ?? PCT_PADRAO
    const usadoDia = await lerContador(chaveDia(fonte, agora))
    const usadoMin = await lerContador(chaveMin(fonte, agora))
    const tetoDia = Math.floor(cfg.perDay * pct)
    const tetoMin = Math.floor(cfg.perMin * pct)
    const pctDia = tetoDia > 0 ? Math.round((usadoDia / tetoDia) * 100) : 100
    resultado[fonte] = { usadoDia, tetoDia, usadoMin, tetoMin, pctDia }
  }

  return resultado
}
