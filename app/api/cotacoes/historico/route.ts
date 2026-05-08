/**
 * GET /api/cotacoes/historico?symbol=SOYB&periodo=1y
 * Histórico diário via Twelve Data (para gráfico grande de cotação).
 * Edge-cached 1h.
 *
 * Símbolos aceitos: SOYB, CORN, WEAT (proxies dos grãos), USD/BRL.
 * Aceita também aliases ZS/ZC/ZW por compatibilidade — mapeados para ETFs.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export const revalidate = 3600

const PERIOD_OUTPUT: Record<string, number> = {
  '1d': 2,
  '1s': 7,
  '1m': 30,
  '6m': 180,
  '1a': 365,
  '1y': 365,
  tudo: 1825,
}

const ALIAS_MAP: Record<string, string> = {
  'ZS=F': 'SOYB',
  'ZC=F': 'CORN',
  'ZW=F': 'WEAT',
  'ZS': 'SOYB',
  'ZC': 'CORN',
  'ZW': 'WEAT',
  'USDBRL=X': 'USD/BRL',
  'USDBRL': 'USD/BRL',
}

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const apiKey = process.env.TWELVEDATA_API_KEY || ''
    if (!apiKey) {
      return NextResponse.json({ data: [], symbol: '', periodo: '', source: 'twelve-data', error: 'TWELVEDATA_API_KEY não configurada' })
    }

    const { searchParams } = new URL(req.url)
    const rawSymbol = searchParams.get('symbol') || 'SOYB'
    const symbol = ALIAS_MAP[rawSymbol] ?? rawSymbol
    const periodo = searchParams.get('periodo') || '1y'
    const outputsize = PERIOD_OUTPUT[periodo] ?? 365
    const interval = outputsize > 365 ? '1week' : '1day'

    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${Math.min(outputsize, 5000)}&apikey=${apiKey}`
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const json = await r.json() as { values?: Array<{ datetime: string; close: string }>; status?: string; message?: string }
    if (json.status === 'error') throw new Error(json.message || 'twelve-data error')
    const values = (json.values || []).slice().reverse()  // mais antigo → mais recente

    // Sample para até ~24 pontos para o gráfico não ficar denso demais
    const SAMPLE = 24
    const step = Math.max(1, Math.floor(values.length / SAMPLE))
    const data: { label: string; value: number }[] = []
    for (let i = 0; i < values.length; i += step) {
      const v = values[i]
      const c = Number(v.close)
      if (Number.isFinite(c)) {
        const d = new Date(v.datetime)
        data.push({
          label: MESES_PT[d.getMonth()],
          value: Math.round(c * 100) / 100,
        })
      }
    }

    return NextResponse.json(
      { data, symbol, periodo, source: 'twelve-data' },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      }
    )
  } catch (e: any) {
    console.error('GET /cotacoes/historico error:', e?.message || e)
    return NextResponse.json(
      { data: [], error: e?.message || 'Erro' },
      { status: 200 }  // soft-fail para não quebrar UI
    )
  }
}
