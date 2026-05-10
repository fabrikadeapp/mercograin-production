/**
 * Rate limit em memória (in-process).
 *
 * Limitações:
 *  - Não compartilha estado entre instâncias (cada processo tem seu próprio Map).
 *  - Em dev local com hot-reload, buckets podem ser resetados em cada reload.
 *  - Para produção em escala (multi-instance), migrar para Redis.
 *
 * Para o estágio atual (single-instance Railway), é suficiente.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// Garbage collect ocasional pra não vazar memória se chegarem muitas chaves únicas.
let lastGc = Date.now()
function maybeGc() {
  const now = Date.now()
  if (now - lastGc < 60_000) return
  lastGc = now
  for (const [k, b] of buckets) {
    if (b.resetAt < now) buckets.delete(k)
  }
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetIn: number // ms até o reset
}

/**
 * Verifica e consome 1 unidade do bucket identificado por `key`.
 *
 * @param key   chave única (ex: `forgot-password:${ip}`)
 * @param max   máximo de requisições permitidas na janela
 * @param windowMs duração da janela em ms
 */
export function rateLimit(
  key: string,
  max: number,
  windowMs: number
): RateLimitResult {
  maybeGc()
  const now = Date.now()
  const b = buckets.get(key)

  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: max - 1, resetIn: windowMs }
  }

  if (b.count >= max) {
    return { ok: false, remaining: 0, resetIn: b.resetAt - now }
  }

  b.count++
  return { ok: true, remaining: max - b.count, resetIn: b.resetAt - now }
}

/**
 * Extrai o IP do cliente de um Request (Next.js). Usa x-forwarded-for ou x-real-ip.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}
