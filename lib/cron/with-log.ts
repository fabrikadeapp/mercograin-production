/**
 * withCronLog — wrapper para registrar execução de crons.
 *
 * Uso:
 *   export async function GET() {
 *     return withCronLog('apurar-comissoes', async (log) => {
 *       const result = await doWork()
 *       log.meta({ processed: result.count })
 *       return NextResponse.json(result)
 *     })
 *   }
 *
 * Garantias:
 *  - Sempre grava CronExecution (success/error)
 *  - Não bloqueia a resposta se gravação falhar
 *  - Trace o tempo de execução automaticamente
 */

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

interface LogContext {
  meta(data: Record<string, unknown>): void
  message(msg: string): void
}

export async function withCronLog<T>(
  cronName: string,
  fn: (ctx: LogContext) => Promise<T>,
): Promise<T> {
  const startedAt = Date.now()
  let metaPayload: Record<string, unknown> = {}
  let messagePayload: string | null = null

  const ctx: LogContext = {
    meta(data) {
      metaPayload = { ...metaPayload, ...data }
    },
    message(msg) {
      messagePayload = msg
    },
  }

  let status: 'success' | 'error' | 'partial' = 'success'
  let result: T
  let errCaught: unknown = null
  try {
    result = await fn(ctx)
  } catch (err) {
    status = 'error'
    errCaught = err
    messagePayload =
      messagePayload ?? (err instanceof Error ? err.message : 'Erro desconhecido')
    if (errCaught) console.error(`[cron:${cronName}]`, errCaught)
  }

  const finishedAt = new Date()
  const durationMs = Date.now() - startedAt

  // Best-effort: não bloqueia se falhar
  db.cronExecution
    .create({
      data: {
        cron: cronName,
        status,
        startedAt: new Date(startedAt),
        finishedAt,
        durationMs,
        message: messagePayload,
        meta:
          Object.keys(metaPayload).length > 0
            ? (metaPayload as any)
            : undefined,
      },
    })
    .catch((e) => console.warn('[cron] log write failed:', e))

  if (errCaught) {
    // Re-throw pra Next devolver 500 (mantém compatibilidade)
    if (errCaught instanceof Error) throw errCaught
    throw new Error(String(errCaught))
  }
  return result!
}

/**
 * Purga registros antigos (>30 dias) — pode ser chamado de outro cron.
 */
export async function purgeOldCronLogs(days = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000)
  const result = await db.cronExecution.deleteMany({
    where: { startedAt: { lt: cutoff } },
  })
  return result.count
}
