/**
 * GET /api/cotacoes/commodities?tab=price|performance|charts|technical
 *
 * Retorna lista de commodities + dados conforme o tab:
 *  - price (default): quote atual em batch (Yahoo)
 *  - performance: variações Daily/1W/1M/YTD/1Y/3Y
 *  - charts: sparkline (90 dias closes) por símbolo
 *  - technical: RSI(14) + EMA(20/50) calculados a partir de 200 closes
 *
 * Filtra pelos symbols do workspace (Workspace.dashboardSymbols) — se não
 * configurado, usa DEFAULT_DASHBOARD_IDS.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import {
  COMMODITIES,
  COMMODITIES_BY_ID,
  DEFAULT_DASHBOARD_IDS,
  type CommodityDef,
} from '@/lib/commodities/catalog'
import {
  getQuotesBatch,
  getPerformance,
  getDailyClosesPublic,
} from '@/lib/commodities/yahoo-batch'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function resolveWorkspaceCommodities(workspaceId: string): Promise<CommodityDef[]> {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { dashboardSymbols: true },
  })
  const ids = Array.isArray(ws?.dashboardSymbols)
    ? (ws.dashboardSymbols as unknown as string[])
    : null
  const finalIds = ids && ids.length > 0 ? ids : DEFAULT_DASHBOARD_IDS
  const list: CommodityDef[] = []
  for (const id of finalIds) {
    const def = COMMODITIES_BY_ID.get(id)
    if (def) list.push(def)
  }
  return list
}

function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gain += diff
    else loss -= diff
  }
  gain /= period
  loss /= period
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const g = diff > 0 ? diff : 0
    const l = diff < 0 ? -diff : 0
    gain = (gain * (period - 1) + g) / period
    loss = (loss * (period - 1) + l) / period
  }
  if (loss === 0) return 100
  const rs = gain / loss
  return 100 - 100 / (1 + rs)
}

function ema(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  const k = 2 / (period + 1)
  let e = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < closes.length; i++) {
    e = closes[i] * k + e * (1 - k)
  }
  return e
}

export async function GET(req: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const tab = req.nextUrl.searchParams.get('tab') ?? 'price'
    const commodities = await resolveWorkspaceCommodities(scope.workspaceId)
    if (commodities.length === 0) {
      return NextResponse.json({ tab, commodities: [], rows: [] })
    }

    // PRICE — batch quote
    if (tab === 'price') {
      const symbols = Array.from(new Set(commodities.map((c) => c.symbol)))
      const quotes = await getQuotesBatch(symbols)
      const rows = commodities.map((c) => {
        const q = quotes[c.symbol]
        return {
          id: c.id,
          name: c.name,
          symbol: c.symbol,
          country: c.country,
          category: c.category,
          contractMonth: q?.contractMonth ?? c.contractMonth ?? null,
          currency: q?.currency ?? c.currency,
          unit: c.unit,
          exchange: c.exchange,
          price: q?.price ?? null,
          high: q?.high ?? null,
          low: q?.low ?? null,
          changeAbs: q?.changeAbs ?? null,
          changePct: q?.changePct ?? null,
          marketTime: q?.regularMarketTime ?? null,
          marketState: q?.marketState ?? null,
        }
      })
      return NextResponse.json({ tab, rows })
    }

    // PERFORMANCE — historical-based pcts
    if (tab === 'performance') {
      const results = await Promise.all(
        commodities.map(async (c) => {
          const perf = await getPerformance(c.symbol).catch(() => ({
            daily: null, week1: null, month1: null, ytd: null, year1: null, year3: null,
          }))
          return {
            id: c.id,
            name: c.name,
            symbol: c.symbol,
            country: c.country,
            category: c.category,
            ...perf,
          }
        }),
      )
      return NextResponse.json({ tab, rows: results })
    }

    // CHARTS — sparkline 90 dias
    if (tab === 'charts') {
      const results = await Promise.all(
        commodities.map(async (c) => ({
          id: c.id,
          name: c.name,
          symbol: c.symbol,
          country: c.country,
          category: c.category,
          closes: await getDailyClosesPublic(c.symbol, 90).catch(() => [] as number[]),
        })),
      )
      return NextResponse.json({ tab, rows: results })
    }

    // SPECIFICATION — metadata estática (root symbol, exchange, contract size, etc.)
    if (tab === 'specification') {
      const rows = commodities.map((c) => ({
        id: c.id,
        name: c.name,
        country: c.country,
        category: c.category,
        rootSymbol: c.rootSymbol ?? null,
        exchange: c.exchange,
        contractSize: c.contractSize ?? null,
        monthsCode: c.monthsCode ?? null,
        pointValue: c.pointValue ?? null,
      }))
      return NextResponse.json({ tab, rows })
    }

    // TECHNICAL — RSI(14), EMA(20), EMA(50)
    if (tab === 'technical') {
      const results = await Promise.all(
        commodities.map(async (c) => {
          const closes = await getDailyClosesPublic(c.symbol, 200).catch(() => [] as number[])
          return {
            id: c.id,
            name: c.name,
            symbol: c.symbol,
            country: c.country,
            category: c.category,
            rsi14: rsi(closes, 14),
            ema20: ema(closes, 20),
            ema50: ema(closes, 50),
            last: closes.length > 0 ? closes[closes.length - 1] : null,
          }
        }),
      )
      return NextResponse.json({ tab, rows: results })
    }

    return NextResponse.json({ error: 'invalid_tab' }, { status: 400 })
  } catch (e: any) {
    console.error('[cotacoes/commodities GET]', e)
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
