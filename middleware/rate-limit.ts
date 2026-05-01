/**
 * Rate Limit Middleware for Next.js
 * Automatically applies rate limiting to all API routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, DEFAULT_LIMITS } from '@/lib/rate-limiter-v2'

/**
 * Apply rate limiting based on route
 */
export async function applyRateLimit(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Determine rate limit config based on route
  let limitKey = 'api:general'
  let config = DEFAULT_LIMITS['api:general']

  if (pathname.includes('/auth/login') || pathname.includes('/auth/signup')) {
    limitKey = 'api:auth'
    config = DEFAULT_LIMITS['api:auth']
  } else if (pathname.includes('/whatsapp')) {
    limitKey = 'api:whatsapp'
    config = DEFAULT_LIMITS['api:whatsapp']
  } else if (pathname.includes('/email')) {
    limitKey = 'api:email'
    config = DEFAULT_LIMITS['api:email']
  } else if (pathname.includes('/backups')) {
    limitKey = 'api:backup'
    config = DEFAULT_LIMITS['api:backup']
  } else if (pathname.includes('/propostas')) {
    limitKey = 'api:propostas'
    config = DEFAULT_LIMITS['api:propostas']
  } else if (pathname.includes('/boletos')) {
    limitKey = 'api:boletos'
    config = DEFAULT_LIMITS['api:boletos']
  } else if (pathname.includes('/cotacoes')) {
    limitKey = 'api:cotacoes'
    config = DEFAULT_LIMITS['api:cotacoes']
  } else if (pathname.includes('/sync')) {
    limitKey = 'api:sync'
    config = DEFAULT_LIMITS['api:sync']
  }

  // Get client IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
             request.headers.get('x-real-ip') ||
             'unknown'

  const key = `${limitKey}:${ip}`

  // Check rate limit
  const result = await checkRateLimit(key, config)

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

/**
 * Middleware to be used in middleware.ts
 * Returns 429 (Too Many Requests) if rate limit exceeded
 */
export async function rateLimitMiddleware(request: NextRequest) {
  // Skip rate limiting for non-API routes and health checks
  const pathname = request.nextUrl.pathname
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  if (pathname === '/api/health' || pathname === '/api/status') {
    return NextResponse.next()
  }

  // Apply rate limiting
  const { allowed, headers, result } = await applyRateLimit(request)

  if (!allowed) {
    const response = NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: `Too many requests. Try again in ${result.retryAfter} seconds.`,
        retryAfter: result.retryAfter,
        resetTime: result.resetTime,
      },
      { status: 429 }
    )

    // Add rate limit headers
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, String(value))
    })

    return response
  }

  // Allow request, add rate limit info to response headers
  const response = NextResponse.next()
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, String(value))
  })

  return response
}
