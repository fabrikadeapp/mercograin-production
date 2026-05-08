/**
 * GET /api/cotacoes/historico?symbol=ZS=F&periodo=1y
 * Histórico diário via Yahoo Finance chart (para gráfico grande de cotação).
 * Edge-cached 1h.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import yahooFinance from 'yahoo-finance2'

export const revalidate = 3600

const PERIOD_DAYS: Record<string, number> = {
  '1d': 1,
  '1s': 7,
  '1m': 30,
  '6m': 180,
  '1a': 365,
  '1y': 365,
  tudo: 1825,
}

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const { searchParams } = new URL(req.url)
    const symbol = searchParams.get('symbol') || 'ZS=F'
    const periodo = searchParams.get('periodo') || '1y'
    const days = PERIOD_DAYS[periodo] ?? 365

    const period2 = new Date()
    const period1 = new Date(period2.getTime() - days * 24 * 60 * 60 * 1000)
    const interval: '1d' | '1wk' = days >= 730 ? '1wk' : '1d'

    const result: any = await yahooFinance.chart(symbol, {
      period1,
      period2,
      interval,
    })
    const quotes = (result?.quotes || []) as any[]

    // sample de até ~24 pontos para chart sem ficar denso demais
    const SAMPLE = 24
    const step = Math.max(1, Math.floor(quotes.length / SAMPLE))
    const data: { label: string; value: number }[] = []
    for (let i = 0; i < quotes.length; i += step) {
      const q = quotes[i]
      const c = q?.close
      if (typeof c === 'number' && Number.isFinite(c)) {
        const d = new Date(q.date)
        data.push({
          label: `${MESES_PT[d.getMonth()]}`,
          value: Math.round(c * 100) / 100,
        })
      }
    }

    return NextResponse.json(
      { data, symbol, periodo, source: 'yahoo-finance' },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      }
    )
  } catch (e: any) {
    console.error('GET /cotacoes/historico error:', e)
    return NextResponse.json(
      { error: e?.message || 'Erro' },
      { status: 500 }
    )
  }
}
