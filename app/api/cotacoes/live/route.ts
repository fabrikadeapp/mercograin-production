/**
 * GET /api/cotacoes/live
 * Live commodity quotes via Twelve Data (ETFs proxy CBOT + USD/BRL).
 *
 * Returns soja/milho/trigo/usdbrl with price, OHLC, prev close, change,
 * currency, market state, and a daily-close sparkline (~30 days).
 *
 * Edge-cached for 30s with stale-while-revalidate.
 */
import { NextResponse } from 'next/server'
import { fetchAllLiveQuotes, fetchSparkline } from '@/lib/quotes/twelvedata'

export const dynamic = 'force-dynamic'
export const revalidate = 30

export async function GET() {
  try {
    const [quotes, sparks] = await Promise.all([
      fetchAllLiveQuotes(),
      Promise.all([
        fetchSparkline('soja'),
        fetchSparkline('milho'),
        fetchSparkline('trigo'),
        fetchSparkline('usdbrl'),
      ]),
    ])

    const payload = {
      soja: { ...quotes.soja, sparkline: sparks[0] },
      milho: { ...quotes.milho, sparkline: sparks[1] },
      trigo: { ...quotes.trigo, sparkline: sparks[2] },
      usdbrl: { ...quotes.usdbrl, sparkline: sparks[3] },
      source: 'twelve-data',
      fetchedAt: new Date().toISOString(),
    }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'live quotes failed' },
      { status: 500 }
    )
  }
}
