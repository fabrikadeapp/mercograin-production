/**
 * GET /api/rate-limits - Admin monitoring dashboard
 * Admin only - View all rate limit statuses
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { getAllRateLimits, getRateLimitStatus, DEFAULT_LIMITS } from '@/lib/rate-limiter-v2'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Check if user is admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
    })

    if (user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acesso restrito a admins' },
        { status: 403 }
      )
    }

    // Check query params
    const { searchParams } = new URL(request.url)
    const reset = searchParams.get('reset')

    if (reset) {
      // Reset specific rate limit (admin only)
      const { resetRateLimit } = await import('@/lib/rate-limiter-v2')
      await resetRateLimit(reset)
      return NextResponse.json({
        success: true,
        message: `Rate limit reset for: ${reset}`,
      })
    }

    // Get all current rate limits
    const allLimits = await getAllRateLimits()

    // Get configured limits info
    const configuredLimits = Object.entries(DEFAULT_LIMITS).map(([key, config]) => ({
      name: key,
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      windowSeconds: Math.round(config.windowMs / 1000),
    }))

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      currentUsage: allLimits,
      configuredLimits,
      totalActiveKeys: allLimits.length,
      topAbusers: allLimits.slice(0, 10),
      info: {
        resetOne: 'GET /api/rate-limits?reset=api:whatsapp:1.2.3.4',
        cleanupNote: 'Expired keys are cleaned automatically',
        monitoringNote: 'Check X-RateLimit-* headers in API responses',
      },
    })
  } catch (error) {
    console.error('Error getting rate limits:', error)
    return NextResponse.json(
      {
        error: 'Erro ao obter limites de taxa',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/rate-limits/cleanup
 * Force cleanup of expired rate limit keys
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Check if user is admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
    })

    if (user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acesso restrito a admins' },
        { status: 403 }
      )
    }

    const { cleanupRateLimits } = await import('@/lib/rate-limiter-v2')
    const cleaned = await cleanupRateLimits()

    return NextResponse.json({
      success: true,
      message: 'Rate limit cleanup completed',
      keysRemoved: cleaned,
    })
  } catch (error) {
    console.error('Error cleaning up rate limits:', error)
    return NextResponse.json(
      {
        error: 'Erro ao limpar limites de taxa',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
