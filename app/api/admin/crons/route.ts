import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/crons
 *
 * Retorna estado dos crons:
 *  - última execução (success/error)
 *  - duração média (últimas 10)
 *  - próxima execução estimada (baseada em padrão de schedule)
 *
 * Restrito a admin global.
 */
export async function GET() {
  try {
    await requireAdmin()

    // Pega últimos 50 registros agrupados por cron
    const recents = await db.cronExecution.findMany({
      orderBy: { startedAt: 'desc' },
      take: 200,
    })

    const byCron = new Map<
      string,
      Array<(typeof recents)[number]>
    >()
    for (const r of recents) {
      const arr = byCron.get(r.cron) ?? []
      arr.push(r)
      byCron.set(r.cron, arr)
    }

    // Lista canônica dos crons conhecidos (mesmo se nunca rodaram, aparecem)
    const KNOWN_CRONS = [
      'apurar-comissoes',
      'bhgrain-alertas',
      'bhgrain-email-fetch',
      'bhgrain-financeiro',
      'bhgrain-health',
      'contrato-marcos',
      'marcacao-diaria',
      'price-alerts',
      'risco-breaches',
      'sync-areas-protegidas',
      'sync-cotacoes',
      'sync-listas-suja',
      'trial-notifications',
      'whatsapp-cotacao-diaria',
      'purge-cron-logs',
      'pg-backup',
    ]

    const summary = KNOWN_CRONS.map((name) => {
      const runs = byCron.get(name) ?? []
      const last = runs[0] ?? null
      const recent10 = runs.slice(0, 10)
      const successCount = recent10.filter((r) => r.status === 'success').length
      const avgDuration = recent10.length
        ? Math.round(
            recent10.reduce((a, r) => a + (r.durationMs ?? 0), 0) /
              recent10.length,
          )
        : null

      return {
        cron: name,
        lastRunAt: last?.startedAt ?? null,
        lastStatus: last?.status ?? null,
        lastMessage: last?.message ?? null,
        lastDurationMs: last?.durationMs ?? null,
        avgDurationMs: avgDuration,
        successRate10: recent10.length
          ? Math.round((successCount / recent10.length) * 100)
          : null,
        runsLast24h: runs.filter(
          (r) => r.startedAt.getTime() > Date.now() - 24 * 3600 * 1000,
        ).length,
      }
    })

    return NextResponse.json({ crons: summary })
  } catch (err) {
    return adminErrorResponse(err)
  }
}
