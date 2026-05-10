import { redis } from '@/lib/redis'
import { rateLimit as memoryRateLimit } from '@/lib/security/rate-limit'

interface RateLimitOptions {
  key: string
  limit: number
  windowMs: number
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: Date
}

// Detecta a presença de Redis via env. O wrapper safeRedis sempre existe,
// mas se REDIS_URL não está setado, todas as ops viram no-op (incr→1) e o
// rate-limit ficaria fail-open. Aqui usamos o fallback in-memory.
const HAS_REDIS = !!process.env.REDIS_URL
let warnedNoRedis = false
function warnFallbackOnce() {
  if (warnedNoRedis) return
  warnedNoRedis = true
  console.warn(
    '[RateLimit] REDIS_URL ausente — usando rate limiter in-memory (single-instance only).',
  )
}

export async function checkRateLimit({
  key,
  limit,
  windowMs,
}: RateLimitOptions): Promise<RateLimitResult> {
  // Fail-closed fallback: sem Redis, usa limiter in-memory (lib/security/rate-limit).
  // Limitação conhecida: estado por processo (multi-instance race), aceitável em
  // single-instance Railway. NUNCA mais retornamos success=true cego.
  if (!HAS_REDIS) {
    warnFallbackOnce()
    const r = memoryRateLimit(key, limit, windowMs)
    return {
      success: r.ok,
      remaining: r.remaining,
      resetTime: new Date(Date.now() + r.resetIn),
    }
  }

  try {
    const current = await redis.incr(key)
    const ttl = await redis.ttl(key)

    if (current === 1) {
      // Primeira requisição, setar TTL
      await redis.expire(key, Math.ceil(windowMs / 1000))
    }

    const success = current <= limit
    const resetTime = new Date(Date.now() + (ttl > 0 ? ttl * 1000 : windowMs))

    return {
      success,
      remaining: Math.max(0, limit - current),
      resetTime,
    }
  } catch (error) {
    console.error('[RateLimit] Erro Redis, fallback in-memory:', error)
    // Falha do Redis em runtime — degrada para in-memory ao invés de fail-open.
    const r = memoryRateLimit(key, limit, windowMs)
    return {
      success: r.ok,
      remaining: r.remaining,
      resetTime: new Date(Date.now() + r.resetIn),
    }
  }
}

export async function getIdempotencyKey(
  key: string,
  ttlSeconds: number = 300
): Promise<{ isNew: boolean; value?: string }> {
  try {
    if (!redis) {
      return { isNew: true }
    }

    const existing = await redis.get(key)

    if (existing) {
      return { isNew: false, value: existing }
    }

    // Marcar como processado
    await redis.setex(key, ttlSeconds, 'processing')

    return { isNew: true }
  } catch (error) {
    console.error('[Idempotency] Erro ao verificar:', error)
    return { isNew: true }
  }
}

export async function markIdempotencyComplete(
  key: string,
  value: string,
  ttlSeconds: number = 300
): Promise<void> {
  try {
    if (!redis) {
      return
    }

    await redis.setex(key, ttlSeconds, value)
  } catch (error) {
    console.error('[Idempotency] Erro ao marcar completo:', error)
  }
}

export async function clearIdempotencyKey(key: string): Promise<void> {
  try {
    if (!redis) {
      return
    }

    await redis.del(key)
  } catch (error) {
    console.error('[Idempotency] Erro ao limpar:', error)
  }
}
