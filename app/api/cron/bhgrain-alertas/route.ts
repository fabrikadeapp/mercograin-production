/**
 * Cron — gera CommercialAlert para todos workspaces.
 * Auth: Authorization: Bearer ${CRON_SECRET}
 * Schedule sugerido: a cada 30 min.
 */
import { NextResponse } from 'next/server'
import { gerarAlertasTodos } from '@/lib/bhgrain/alerts-generator'
import { isBhGrainV1Enabled } from '@/lib/bhgrain/feature-flag'
import { captureError } from '@/lib/observability/capture'

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
    const stats = await gerarAlertasTodos()
    const total = stats.reduce((s, r) => s + r.criados, 0)
    return NextResponse.json({ ok: true, total, byWorkspace: stats })
  } catch (e) {
    captureError(e, { where: 'cron.bhgrain-alertas' })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro' }, { status: 500 })
  }
}

export { handle as GET, handle as POST }
