/**
 * GET /api/cotacoes/live
 * Live commodity quotes via Yahoo Finance (CBOT futures + USDBRL).
 *
 * Returns soja/milho/trigo/usdbrl with price, OHLC, prev close, change,
 * currency, market state, and a daily-close sparkline (~30 days).
 *
 * Edge-cached for 30s with stale-while-revalidate.
 */
import { NextResponse } from 'next/server'
import { fetchAllLiveQuotes, YAHOO_SYMBOLS } from '@/lib/quotes/yahoo'
import { fetchSparkline } from '@/lib/quotes/sparkline'

export const dynamic = 'force-dynamic'
export const revalidate = 30

export async function GET() {
  try {
    const [quotes, sparks] = await Promise.all([
      fetchAllLiveQuotes(),
      Promise.all([
        fetchSparkline(YAHOO_SYMBOLS.soja.symbol),
        fetchSparkline(YAHOO_SYMBOLS.milho.symbol),
        fetchSparkline(YAHOO_SYMBOLS.trigo.symbol),
        fetchSparkline(YAHOO_SYMBOLS.usdbrl.symbol),
      ]),
    ])

    const payload = {
      soja: { ...quotes.soja, sparkline: sparks[0] },
      milho: { ...quotes.milho, sparkline: sparks[1] },
      trigo: { ...quotes.trigo, sparkline: sparks[2] },
      usdbrl: { ...quotes.usdbrl, sparkline: sparks[3] },
      source: 'yahoo-finance',
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
