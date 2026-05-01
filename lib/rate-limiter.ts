/**
 * Simple in-memory rate limiter for email operations
 * In production, use Redis for distributed rate limiting
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

const limits = new Map<string, RateLimitEntry>()

/**
 * Check if an action is rate limited
 * @param key Unique key (e.g., email, IP)
 * @param maxAttempts Maximum attempts allowed
 * @param windowMs Time window in milliseconds
 * @returns true if action is allowed, false if rate limited
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 3,
  windowMs: number = 3600000 // 1 hour default
): boolean {
  const now = Date.now()
  const entry = limits.get(key)

  // First attempt or window expired
  if (!entry || now > entry.resetTime) {
    limits.set(key, {
      count: 1,
      resetTime: now + windowMs,
    })
    return true
  }

  // Still within window
  if (entry.count < maxAttempts) {
    entry.count++
    return true
  }

  // Rate limited
  return false
}

/**
 * Get remaining attempts for a key
 */
export function getRemainingAttempts(
  key: string,
  maxAttempts: number = 3,
  windowMs: number = 3600000
): number {
  const now = Date.now()
  const entry = limits.get(key)

  if (!entry || now > entry.resetTime) {
    return maxAttempts
  }

  return Math.max(0, maxAttempts - entry.count)
}

/**
 * Get time until rate limit resets (in seconds)
 */
export function getResetTime(key: string): number {
  const entry = limits.get(key)
  if (!entry) return 0

  const remaining = Math.max(0, entry.resetTime - Date.now())
  return Math.ceil(remaining / 1000)
}

/**
 * Clear rate limit for a key
 */
export function clearRateLimit(key: string): void {
  limits.delete(key)
}

/**
 * Clear all rate limits (for testing)
 */
export function clearAllRateLimits(): void {
  limits.clear()
}

/**
 * Cleanup expired entries (call periodically)
 */
export function cleanupExpiredLimits(): void {
  const now = Date.now()
  for (const [key, entry] of limits.entries()) {
    if (now > entry.resetTime) {
      limits.delete(key)
    }
  }
}

// Cleanup every 10 minutes
setInterval(cleanupExpiredLimits, 10 * 60 * 1000)
