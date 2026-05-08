import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stripe } from '@/lib/stripe/server'
import { fetchCepeaQuotes } from '@/lib/quotes/cepea'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

interface CheckResult {
  name: string
  ok: boolean
  detail?: string
  ms: number
}

async function timed<T>(
  name: string,
  fn: () => Promise<T>,
  detailFn?: (r: T) => string,
): Promise<{ result: CheckResult; value: T | null }> {
  const t0 = Date.now()
  try {
    const r = await fn()
    return {
      result: {
        name,
        ok: true,
        ms: Date.now() - t0,
        detail: detailFn ? detailFn(r) : undefined,
      },
      value: r,
    }
  } catch (e) {
    return {
      result: {
        name,
        ok: false,
        ms: Date.now() - t0,
        detail: e instanceof Error ? e.message : String(e),
      },
      value: null,
    }
  }
}

export async function GET() {
  try {
    await requireAdmin()
    const [pg, st, cepea, td, evo] = await Promise.all([
      timed('PostgreSQL', () => db.$queryRaw`SELECT 1`, () => 'OK · SELECT 1'),
      timed(
        'Stripe',
        () => stripe.balance.retrieve(),
        (r) => {
          const avail = r.available?.[0]
          return avail
            ? `Saldo ${(avail.amount / 100).toFixed(2)} ${avail.currency.toUpperCase()}`
            : 'OK'
        },
      ),
      timed(
        'CEPEA',
        () => fetchCepeaQuotes(['soja']),
        (r) =>
          r.soja?.dataReferencia
            ? `Soja R$ ${r.soja.precoSc60?.toFixed(2)} · ref ${r.soja.dataReferencia}`
            : 'sem dados',
      ),
      timed(
        'Twelve Data',
        async () => {
          const key = process.env.TWELVE_DATA_API_KEY
          if (!key) throw new Error('TWELVE_DATA_API_KEY ausente')
          const r = await fetch(
            `https://api.twelvedata.com/quote?symbol=USD/BRL&apikey=${key}`,
            { signal: AbortSignal.timeout(5000) },
          )
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return await r.json()
        },
        (r) =>
          (r as any)?.close
            ? `USD/BRL ${(r as any).close}`
            : (r as any)?.message ?? 'sem dados',
      ),
      timed(
        'Evolution API',
        async () => {
          const { getConnectionState } = await import('@/lib/whatsapp/evolution')
          return await getConnectionState()
        },
        (r) => `state=${(r as any).state}`,
      ),
    ])

    const recentErrors = await db.webhookLog.findMany({
      where: { status: 'erro' },
      orderBy: { criadoEm: 'desc' },
      take: 50,
    })

    return NextResponse.json({
      checks: [pg.result, st.result, cepea.result, td.result, evo.result],
      server: {
        uptimeSeconds: Math.round(process.uptime()),
        memory: process.memoryUsage(),
        node: process.version,
      },
      flags: {
        impersonate: process.env.ENABLE_IMPERSONATE === 'true',
      },
      recentErrors: recentErrors.map((e) => ({
        id: e.id,
        tipo: e.tipo,
        mensagem: e.mensagem,
        codigoErro: e.codigoErro,
        criadoEm: e.criadoEm,
      })),
    })
  } catch (e) {
    return adminErrorResponse(e)
  }
}
