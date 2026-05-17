/**
 * Cron — coleta health checks de integrações para todos workspaces.
 * Auth: Authorization: Bearer ${CRON_SECRET}
 * Schedule sugerido: a cada 10-15 min.
 */
import { NextResponse } from 'next/server'
import { collectHealthAll } from '@/lib/bhgrain/health-collector'
import { isBhGrainV1Enabled } from '@/lib/bhgrain/feature-flag'
import { captureError } from '@/lib/observability/capture'
import { withCronLog } from '@/lib/cron/with-log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

async function handle(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!(await isBhGrainV1Enabled())) {
    return NextResponse.json({ skipped: true, reason: 'bhgrain.v1 disabled' })
  }

  try {
    const r = await collectHealthAll()
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    captureError(e, { where: 'cron.bhgrain-health' })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return withCronLog('bhgrain-health', () => handle(req))
}
export async function POST(req: Request) {
  return withCronLog('bhgrain-health', () => handle(req))
}
