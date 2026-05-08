/**
 * GET /api/cotacoes/historico?symbol=SOYB&periodo=1y
 * Histórico para gráfico grande, com cache em memória de 1h.
 *
 * Aliases ZS=F/ZC=F/ZW=F/USDBRL=X mapeiam automaticamente para os
 * símbolos do Twelve Data.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { fetchHistorico } from '@/lib/quotes/twelvedata'

export const dynamic = 'force-dynamic'

const ALIAS_MAP: Record<string, string> = {
  'ZS=F': 'SOYB', 'ZC=F': 'CORN', 'ZW=F': 'WEAT',
  'ZS': 'SOYB', 'ZC': 'CORN', 'ZW': 'WEAT',
  'USDBRL=X': 'USD/BRL', 'USDBRL': 'USD/BRL',
}

const VALID_PERIODOS = ['1d', '1s', '1m', '6m', '1a', 'tudo'] as const
type Periodo = typeof VALID_PERIODOS[number]

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const DIAS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function formatLabel(d: Date, periodo: Periodo): string {
  if (periodo === '1d') return `${String(d.getHours()).padStart(2, '0')}h`
  if (periodo === '1s') return DIAS_PT[d.getDay()]
  return MESES_PT[d.getMonth()]
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const rawSymbol = searchParams.get('symbol') || 'SOYB'
    const symbol = ALIAS_MAP[rawSymbol] ?? rawSymbol
    const rawPeriodo = (searchParams.get('periodo') || '1m').toLowerCase()
    const periodo: Periodo = (VALID_PERIODOS as readonly string[]).includes(rawPeriodo)
      ? (rawPeriodo as Periodo)
      : '1m'

    const points = await fetchHistorico(symbol, periodo)

    if (points.length === 0) {
      return NextResponse.json(
        { data: [], symbol, periodo, source: 'twelve-data', empty: true },
        {
          headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
        }
      )
    }

    // Sample para até ~24-32 pontos
    const SAMPLE = periodo === '1d' || periodo === '1s' ? 32 : 24
    const step = Math.max(1, Math.floor(points.length / SAMPLE))
    const data: { label: string; value: number }[] = []
    for (let i = 0; i < points.length; i += step) {
      const p = points[i]
      const d = new Date(p.datetime)
      data.push({
        label: formatLabel(d, periodo),
        value: Math.round(p.close * 100) / 100,
      })
    }

    return NextResponse.json(
      { data, symbol, periodo, source: 'twelve-data' },
      {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
      }
    )
  } catch (e: any) {
    console.error('GET /cotacoes/historico:', e?.message || e)
    return NextResponse.json({ data: [], error: e?.message || 'erro' }, { status: 200 })
  }
}
