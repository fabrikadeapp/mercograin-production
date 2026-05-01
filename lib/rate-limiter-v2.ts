/**
 * Rate Limiter v2 - Redis-based rate limiting
 * Supports multiple strategies and custom limits per endpoint
 */

import { redis } from './redis'

export interface RateLimitConfig {
  windowMs: number      // Time window in milliseconds
  maxRequests: number   // Max requests per window
  message?: string      // Custom error message
  keyGenerator?: (req: any) => string  // Custom key function
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: Date
  limit: number
  retryAfter?: number
}

/**
 * Default rate limit configurations for different endpoints
 */
export const DEFAULT_LIMITS = {
  // API endpoints
  'api:general': {
    windowMs: 60 * 1000,        // 1 minute
    maxRequests: 100,
  },
  'api:auth': {
    windowMs: 15 * 60 * 1000,   // 15 minutes
    maxRequests: 5,             // 5 login attempts
  },
  'api:whatsapp': {
    windowMs: 60 * 1000,        // 1 minute
    maxRequests: 20,            // 20 msgs/min (avoid WhatsApp blocks)
  },
  'api:email': {
    windowMs: 60 * 1000,        // 1 minute
    maxRequests: 10,            // 10 emails/min
  },
  'api:backup': {
    windowMs: 60 * 60 * 1000,   // 1 hour
    maxRequests: 5,             // 5 backups/hour
  },
  'api:propostas': {
    windowMs: 60 * 1000,        // 1 minute
    maxRequests: 30,
  },
  'api:boletos': {
    windowMs: 60 * 1000,        // 1 minute
    maxRequests: 30,
  },
  'api:cotacoes': {
    windowMs: 10 * 1000,        // 10 seconds
    maxRequests: 3,             // 3 requests / 10s (avoid scraping overload)
  },
  'api:sync': {
    windowMs: 60 * 1000,        // 1 minute
    maxRequests: 2,             // 2 syncs/min
  },
}

/**
 * Check rate limit and return status
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_LIMITS['api:general']
): Promise<RateLimitResult> {
  try {
    const rateLimitKey = `ratelimit:${key}`
    const now = Date.now()
    const windowStart = now - config.windowMs

    // Get current count
    let count = await redis.get(rateLimitKey)
    let currentCount = count ? parseInt(count) : 0

    // Check if we need to reset (window expired)
    const lastResetKey = `ratelimit:${key}:reset`
    const lastReset = await redis.get(lastResetKey)

    if (!lastReset || parseInt(lastReset) < windowStart) {
      // Reset the counter
      currentCount = 0
      await redis.del(rateLimitKey)
      await redis.setex(lastResetKey, Math.ceil(config.windowMs / 1000) + 1, now.toString())
    }

    // Increment counter
    currentCount += 1
    const ttl = Math.ceil(config.windowMs / 1000)
    await redis.setex(rateLimitKey, ttl, currentCount.toString())

    // Calculate reset time
    const resetTimestamp = parseInt(lastReset || now.toString()) + config.windowMs
    const resetTime = new Date(resetTimestamp)

    // Determine if request is allowed
    const allowed = currentCount <= config.maxRequests
    const remaining = Math.max(0, config.maxRequests - currentCount)
    const retryAfter = allowed ? undefined : Math.ceil((resetTimestamp - now) / 1000)

    return {
      allowed,
      remaining,
      resetTime,
      limit: config.maxRequests,
      retryAfter,
    }
  } catch (error) {
    console.error('[RateLimit] Erro ao verificar limite:', error)
    // On error, allow request (fail open)
    return {
      allowed: true,
      remaining: 0,
      resetTime: new Date(),
      limit: 0,
    }
  }
}

/**
 * Create a rate limit middleware for Next.js
 */
export function createRateLimitMiddleware(limitKey: string, config?: RateLimitConfig) {
  const finalConfig = config || (DEFAULT_LIMITS[limitKey as keyof typeof DEFAULT_LIMITS] || DEFAULT_LIMITS['api:general'])

  return async (req: any) => {
    // Generate unique key (IP + endpoint)
    const ip = req.headers.get('x-forwarded-for') ||
               req.headers.get('x-real-ip') ||
               'unknown'
    const key = `${limitKey}:${ip}`

    const result = await checkRateLimit(key, finalConfig)

    return {
      allowed: result.allowed,
      headers: {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetTime.toISOString(),
        ...(result.retryAfter && { 'Retry-After': result.retryAfter.toString() }),
      },
      result,
    }
  }
}

/**
 * Get rate limit status for a key
 */
export async function getRateLimitStatus(
  key: string,
  config: RateLimitConfig = DEFAULT_LIMITS['api:general']
) {
  try {
    const rateLimitKey = `ratelimit:${key}`
    const count = await redis.get(rateLimitKey)
    const currentCount = count ? parseInt(count) : 0
    const remaining = Math.max(0, config.maxRequests - currentCount)

    const lastResetKey = `ratelimit:${key}:reset`
    const lastReset = await redis.get(lastResetKey)
    const resetTime = lastReset ? new Date(parseInt(lastReset) + config.windowMs) : new Date()

    return {
      key,
      current: currentCount,
      limit: config.maxRequests,
      remaining,
      windowMs: config.windowMs,
      resetTime,
      percentage: Math.round((currentCount / config.maxRequests) * 100),
    }
  } catch (error) {
    console.error('[RateLimit] Erro ao obter status:', error)
    return null
  }
}

/**
 * Reset rate limit for a specific key
 */
export async function resetRateLimit(key: string) {
  try {
    const rateLimitKey = `ratelimit:${key}`
    const lastResetKey = `ratelimit:${key}:reset`
    await redis.del(rateLimitKey)
    await redis.del(lastResetKey)
    console.log(`[RateLimit] Reset: ${key}`)
    return true
  } catch (error) {
    console.error('[RateLimit] Erro ao resetar:', error)
    return false
  }
}

/**
 * Get all rate limit keys (for monitoring)
 */
export async function getAllRateLimits(pattern: string = 'ratelimit:*') {
  try {
    const keys = await redis.keys(pattern)
    const limits = []

    for (const key of keys) {
      if (!key.includes(':reset')) {
        const count = await redis.get(key)
        limits.push({
          key: key.replace('ratelimit:', ''),
          count: count ? parseInt(count) : 0,
        })
      }
    }

    return limits.sort((a, b) => b.count - a.count)
  } catch (error) {
    console.error('[RateLimit] Erro ao listar limites:', error)
    return []
  }
}

/**
 * Cleanup expired rate limit keys
 */
export async function cleanupRateLimits() {
  try {
    const pattern = 'ratelimit:*'
    const keys = await redis.keys(pattern)
    let cleaned = 0

    for (const key of keys) {
      const ttl = await redis.ttl(key)
      if (ttl === -1) {
        // No TTL set, delete it
        await redis.del(key)
        cleaned++
      }
    }

    console.log(`[RateLimit] Limpeza: ${cleaned} chaves removidas`)
    return cleaned
  } catch (error) {
    console.error('[RateLimit] Erro na limpeza:', error)
    return 0
  }
}
