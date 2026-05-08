import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { fetchLiveQuote, type QuoteLabel } from '@/lib/quotes/twelvedata'

export const dynamic = 'force-dynamic'

const SPREAD_PCT_CBOT: Record<string, number> = {
  soja: 0.05,
  milho: 0.07,
  trigo: 0.08,
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const graoRaw = (searchParams.get('grao') || 'soja').toLowerCase()
    const grao = (['soja', 'milho', 'trigo'].includes(graoRaw)
      ? graoRaw
      : 'soja') as 'soja' | 'milho' | 'trigo'

    const q = await fetchLiveQuote(grao as QuoteLabel)

    if (q.price === null) {
      return NextResponse.json({
        grao,
        fonte: 'CBOT via Teucrium ETF (Twelve Data)',
        unidade: 'USD/cota',
        bid: null,
        ask: null,
        spread: null,
        mid: null,
        symbol: q.symbol,
        marketState: q.marketState,
        empty: true,
        observacao: 'rate limit ou mercado fechado',
        fetchedAt: q.fetchedAt,
      })
    }

    const spreadPct = SPREAD_PCT_CBOT[grao] || 0.05
    const spread = (spreadPct / 100) * q.price
    const bid = Math.round((q.price - spread / 2) * 10000) / 10000
    const ask = Math.round((q.price + spread / 2) * 10000) / 10000

    return NextResponse.json({
      grao,
      fonte: 'CBOT via Teucrium ETF (Twelve Data)',
      unidade: 'USD/cota',
      symbol: q.symbol,
      marketState: q.marketState,
      bid: { price: bid, source: 'Estimado · spread interbancário' },
      ask: { price: ask, source: 'Estimado · spread interbancário' },
      mid: q.price,
      spread,
      spreadPct,
      changePct: q.changePct,
      changeAbs: q.changeAbs,
      fetchedAt: q.fetchedAt,
      observacao: `${q.symbol} ETF Teucrium como proxy. Free tier não cobre ZS=F/ZC=F/ZW=F.`,
    })
  } catch (error) {
    console.error('[futuros/cbot] erro:', error)
    return NextResponse.json(
      { error: 'Erro ao consultar CBOT proxy' },
      { status: 500 },
    )
  }
}
