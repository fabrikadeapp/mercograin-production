/**
 * Cron — Email IMAP fetcher para todos workspaces com credencial enabled.
 * Sugestão: a cada 5–10 min em horário comercial.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 */
import { NextResponse } from 'next/server'
import { fetchAllWorkspacesEmail } from '@/lib/bhgrain/email-fetcher'
import { isBhGrainV1Enabled } from '@/lib/bhgrain/feature-flag'
import { captureError } from '@/lib/observability/capture'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // até 5min — IMAP pode ser lento em muitos workspaces

async function handle(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!(await isBhGrainV1Enabled())) {
    return NextResponse.json({ skipped: true, reason: 'bhgrain.v1 disabled' })
  }

  try {
    const stats = await fetchAllWorkspacesEmail()
    const totais = stats.reduce(
      (acc, s) => ({
        novasMensagens: acc.novasMensagens + s.novasMensagens,
        workspacesOk: acc.workspacesOk + (s.ok ? 1 : 0),
        workspacesFail: acc.workspacesFail + (s.ok ? 0 : 1),
      }),
      { novasMensagens: 0, workspacesOk: 0, workspacesFail: 0 }
    )
    return NextResponse.json({ ok: true, workspaces: stats.length, ...totais })
  } catch (e) {
    captureError(e, { where: 'cron.bhgrain-email-fetch' })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro' }, { status: 500 })
  }
}

export { handle as GET, handle as POST }
