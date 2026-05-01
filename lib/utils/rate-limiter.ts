import { redis } from '@/lib/redis'

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

export async function checkRateLimit({
  key,
  limit,
  windowMs,
}: RateLimitOptions): Promise<RateLimitResult> {
  try {
    if (!redis) {
      // Fallback: sem Redis, permitir tudo (com log)
      console.warn('[RateLimit] Redis não disponível, permitindo requisição')
      return {
        success: true,
        remaining: limit,
        resetTime: new Date(Date.now() + windowMs),
      }
    }

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
    console.error('[RateLimit] Erro ao verificar limite:', error)
    // Em caso de erro, permitir (fail-open)
    return {
      success: true,
      remaining: limit,
      resetTime: new Date(Date.now() + windowMs),
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
