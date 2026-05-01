import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/webhooks/health
 * Health check endpoint para monitorar status dos webhooks
 * Retorna informações sobre:
 * - Uptime da aplicação
 * - Status de conexão com banco de dados
 * - Status de conexão com Redis
 * - Último webhook recebido
 * - Taxa de erro nos últimos 24 horas
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()

  try {
    // 1. Verificar conexão com banco de dados
    let dbHealthy = false
    let dbLatency = 0

    try {
      const dbStart = Date.now()
      await (db.webhookLog.count() as any)
      dbLatency = Date.now() - dbStart
      dbHealthy = true
    } catch (error) {
      console.error('[Health] Database error:', error)
    }

    // 2. Verificar conexão com Redis
    let redisHealthy = false
    let redisLatency = 0

    try {
      if (redis) {
        const redisStart = Date.now()
        await redis.ping()
        redisLatency = Date.now() - redisStart
        redisHealthy = true
      }
    } catch (error) {
      console.error('[Health] Redis error:', error)
    }

    // 3. Obter última cotação recebida
    let lastWebhook: { timestamp: Date; grao: string } | null = null
    try {
      const lastLog = await db.webhookLog.findFirst({
        where: { tipo: 'tradingview', status: 'processado' as any },
        orderBy: { criadoEm: 'desc' },
        take: 1,
      } as any)

      if (lastLog) {
        lastWebhook = {
          timestamp: lastLog.criadoEm,
          grao: (lastLog.payload as any)?.ticker || 'unknown',
        }
      }
    } catch (error) {
      console.error('[Health] Error fetching last webhook:', error)
    }

    // 4. Calcular taxa de erro (últimas 24 horas)
    let errorRate24h = 0
    let totalWebhooks24h = 0
    let errorCount24h = 0

    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

      const total = await db.webhookLog.count({
        where: {
          tipo: 'tradingview',
          criadoEm: { gte: oneDayAgo },
        },
      })

      const errors = await db.webhookLog.count({
        where: {
          tipo: 'tradingview',
          status: 'erro' as any,
          criadoEm: { gte: oneDayAgo },
        },
      })

      totalWebhooks24h = total
      errorCount24h = errors
      errorRate24h = total > 0 ? (errors / total) * 100 : 0
    } catch (error) {
      console.error('[Health] Error calculating error rate:', error)
    }

    // 5. Status geral
    const healthy = dbHealthy && redisHealthy
    const statusCode = healthy ? 200 : 503

    const responseTime = Date.now() - startTime

    const response = {
      status: healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: {
          healthy: dbHealthy,
          latency: `${dbLatency}ms`,
        },
        redis: {
          healthy: redisHealthy,
          latency: redisHealthy ? `${redisLatency}ms` : 'unavailable',
        },
      },
      webhooks: {
        lastReceived: lastWebhook ? {
          timestamp: lastWebhook.timestamp.toISOString(),
          grao: lastWebhook.grao,
        } : null,
        metrics24h: {
          total: totalWebhooks24h,
          errors: errorCount24h,
          errorRate: `${errorRate24h.toFixed(2)}%`,
        },
      },
      performance: {
        healthCheckLatency: `${responseTime}ms`,
      },
    }

    return NextResponse.json(response, { status: statusCode })
  } catch (error) {
    console.error('[Health] Unexpected error:', error)

    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
