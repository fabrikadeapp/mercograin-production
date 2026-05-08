/**
 * GET /api/cotacoes/watchlist?symbols=ZS=F,ZC=F,...
 * Retorna quote+sparkline para cada símbolo. Default cobre commodities + FX.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import yahooFinance from 'yahoo-finance2'
import { fetchSparkline } from '@/lib/quotes/sparkline'

export const revalidate = 30

const DEFAULT_SYMBOLS = [
  { symbol: 'ZS=F', label: 'Soja', ticker: 'ZS' },
  { symbol: 'ZC=F', label: 'Milho', ticker: 'ZC' },
  { symbol: 'ZW=F', label: 'Trigo', ticker: 'ZW' },
  { symbol: 'ZG=F', label: 'Sorgo', ticker: 'ZG' },
  { symbol: 'CT=F', label: 'Algodão', ticker: 'CT' },
  { symbol: 'KC=F', label: 'Café Arábica', ticker: 'KC' },
  { symbol: 'SB=F', label: 'Açúcar', ticker: 'SB' },
  { symbol: 'USDBRL=X', label: 'Dólar', ticker: 'USDBRL' },
  { symbol: 'EURBRL=X', label: 'Euro', ticker: 'EURBRL' },
  { symbol: 'CNYBRL=X', label: 'Yuan', ticker: 'CNYBRL' },
  { symbol: 'ARSBRL=X', label: 'Peso AR', ticker: 'ARSBRL' },
]

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const { searchParams } = new URL(req.url)
    const param = searchParams.get('symbols')
    let list = DEFAULT_SYMBOLS
    if (param) {
      list = param.split(',').map((s) => {
        const found = DEFAULT_SYMBOLS.find((d) => d.symbol === s.trim())
        return found || { symbol: s.trim(), label: s.trim(), ticker: s.trim() }
      })
    }

    const items = await Promise.all(
      list.map(async (it) => {
        try {
          const [q, spark] = await Promise.all([
            (yahooFinance.quote(it.symbol) as Promise<any>).catch(() => null),
            fetchSparkline(it.symbol),
          ])
          const price = (q as any)?.regularMarketPrice ?? null
          const prev = (q as any)?.regularMarketPreviousClose ?? null
          const changePct =
            price !== null && prev !== null && prev !== 0
              ? ((price - prev) / prev) * 100
              : null
          return {
            symbol: it.symbol,
            label: it.label,
            ticker: it.ticker,
            price,
            previousClose: prev,
            changePct,
            currency: (q as any)?.currency || null,
            sparkline: spark,
          }
        } catch {
          return {
            symbol: it.symbol,
            label: it.label,
            ticker: it.ticker,
            price: null,
            previousClose: null,
            changePct: null,
            currency: null,
            sparkline: [],
          }
        }
      })
    )

    return NextResponse.json(
      { items, fetchedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    )
  } catch (e: any) {
    console.error('GET /cotacoes/watchlist error:', e)
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 500 })
  }
}
