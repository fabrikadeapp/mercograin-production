/**
 * Cron — materializa previsão de receita BH Grain em MovimentoFinanceiro.
 * Sugestão: a cada 1h.
 */
import { NextResponse } from 'next/server'
import { syncPrevisaoTodos } from '@/lib/bhgrain/financeiro-previsao'
import { isBhGrainV1Enabled } from '@/lib/bhgrain/feature-flag'
import { captureError } from '@/lib/observability/capture'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

async function handle(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!(await isBhGrainV1Enabled())) {
    return NextResponse.json({ skipped: true })
  }

  try {
    const stats = await syncPrevisaoTodos()
    const total = stats.reduce(
      (acc, s) => ({
        criados: acc.criados + s.criados,
        atualizados: acc.atualizados + s.atualizados,
        removidos: acc.removidos + s.removidos,
        realizados: acc.realizados + s.realizados,
      }),
      { criados: 0, atualizados: 0, removidos: 0, realizados: 0 }
    )
    return NextResponse.json({ ok: true, ...total, workspaces: stats.length })
  } catch (e) {
    captureError(e, { where: 'cron.bhgrain-financeiro' })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro' }, { status: 500 })
  }
}

export { handle as GET, handle as POST }
