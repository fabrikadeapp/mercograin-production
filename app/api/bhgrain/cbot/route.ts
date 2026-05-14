/**
 * GET /api/bhgrain/cbot
 *
 * Snapshot tempo-real dos futuros agrícolas no CBOT (Chicago Board of Trade)
 * com dados completos: preço, variação, hi/lo do dia, volume, vencimento.
 *
 * Retorna o preço NATIVO (cents/bushel) + USD/bu + R$/sc60kg para a UI escolher.
 *
 * Símbolos:
 *  - Soja:  ZS=F (Soybeans, 5000 bu/contract, USc/bu × 1/100 = USD/bu)
 *  - Milho: ZC=F (Corn,     5000 bu/contract, USc/bu × 1/100 = USD/bu)
 *  - Trigo: ZW=F (SRW Wheat, 5000 bu/contract, USc/bu × 1/100 = USD/bu)
 *
 * Conversões padrão da indústria:
 *  - Soja  : 1 bushel = 27,2155 kg → 1 sc 60kg = 60/27,2155 ≈ 2,20462 bu
 *  - Milho : 1 bushel = 25,4012 kg → 1 sc 60kg = 60/25,4012 ≈ 2,36206 bu
 *  - Trigo : 1 bushel = 27,2155 kg → 1 sc 60kg = 60/27,2155 ≈ 2,20462 bu
 */

import { NextResponse } from 'next/server'
import { requireScope } from '@/lib/auth/scope'
import { getQuotesBatch } from '@/lib/commodities/yahoo-batch'
import { fetchFxBidAsk } from '@/lib/quotes/awesomeapi'
import { fetchBcbDolar } from '@/lib/quotes/bcb'
import { marketStatus } from '@/lib/quotes/market-hours'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const FUTUROS = {
  soja: 'ZS=F',
  milho: 'ZC=F',
  trigo: 'ZW=F',
} as const

// kg por bushel — diferente por grão
const KG_POR_BU: Record<keyof typeof FUTUROS, number> = {
  soja: 27.2155,
  milho: 25.4012,
  trigo: 27.2155,
}

type Grao = keyof typeof FUTUROS

interface CbotItem {
  grao: Grao
  nome: string
  vencimento: string | null
  marketState: string | null
  capturadaEm: string | null
  // Preço nativo CBOT
  centsBu: number | null // ex.: 1225.50 = cents/bushel
  usdBu: number | null // ex.: 12.2550
  // Conversão R$
  brlSc60: number | null // R$ por saca de 60kg
  brlTon: number | null // R$ por tonelada
  // Variação
  changePct: number | null
  changeAbs: number | null // em USD/bu
  previousClose: number | null // cents/bu
  // Range do dia
  highBu: number | null // USD/bu
  lowBu: number | null // USD/bu
  openBu: number | null
}

async function getUsdBrlPrice(): Promise<{ price: number | null; fonte: string; capturadaEm: string | null; intraday: boolean }> {
  // Prioridade absoluta: AwesomeAPI (intraday, bid/ask mid)
  try {
    const fx = await fetchFxBidAsk('USD-BRL')
    if (fx?.bid != null && fx?.ask != null) {
      const mid = (Number(fx.bid) + Number(fx.ask)) / 2
      if (Number.isFinite(mid) && mid > 0) {
        return {
          price: mid,
          fonte: 'AwesomeAPI · intraday',
          capturadaEm: fx.timestamp ?? fx.fetchedAt ?? new Date().toISOString(),
          intraday: true,
        }
      }
    }
  } catch (err) {
    console.warn('[cbot] AwesomeAPI USD/BRL falhou:', err instanceof Error ? err.message : err)
  }
  // Fallback: BCB PTAX (oficial fechamento — pode ser de ontem)
  try {
    const bcb = await fetchBcbDolar()
    if (bcb?.cotacaoVenda != null) {
      return {
        price: Number(bcb.cotacaoVenda),
        fonte: 'BCB · PTAX fechamento',
        capturadaEm: bcb.dataHoraCotacao ?? bcb.fetchedAt ?? new Date().toISOString(),
        intraday: false,
      }
    }
  } catch (err) {
    console.warn('[cbot] BCB PTAX falhou:', err instanceof Error ? err.message : err)
  }
  return { price: null, fonte: '—', capturadaEm: null, intraday: false }
}

export async function GET() {
  try {
    await requireScope()

    const [futQuotes, fx] = await Promise.all([
      getQuotesBatch(Object.values(FUTUROS) as unknown as string[]),
      getUsdBrlPrice(),
    ])

    const items: CbotItem[] = (Object.keys(FUTUROS) as Grao[]).map((grao) => {
      const fut = futQuotes[FUTUROS[grao]]
      const nome = grao === 'soja' ? 'Soja CBOT' : grao === 'milho' ? 'Milho CBOT' : 'Trigo SRW CBOT'
      if (!fut || fut.price == null) {
        return {
          grao,
          nome,
          vencimento: fut?.contractMonth ?? null,
          marketState: fut?.marketState ?? null,
          capturadaEm: fut?.fetchedAt ?? null,
          centsBu: null,
          usdBu: null,
          brlSc60: null,
          brlTon: null,
          changePct: fut?.changePct ?? null,
          changeAbs: null,
          previousClose: null,
          highBu: null,
          lowBu: null,
          openBu: null,
        }
      }
      const centsBu = fut.price // ex.: 1225.50
      const usdBu = centsBu / 100 // 12.2550
      const kgBu = KG_POR_BU[grao]
      const buPorSc60 = 60 / kgBu
      const usdSc60 = usdBu * buPorSc60
      const brlSc60 = fx.price != null ? usdSc60 * fx.price : null
      const brlTon = brlSc60 != null ? (brlSc60 / 60) * 1000 : null

      const changeAbsUsdBu = fut.changeAbs != null ? fut.changeAbs / 100 : null
      const highBu = fut.high != null ? fut.high / 100 : null
      const lowBu = fut.low != null ? fut.low / 100 : null
      const openBu = fut.open != null ? fut.open / 100 : null
      const prevClose = fut.previousClose

      return {
        grao,
        nome,
        vencimento: fut.contractMonth,
        marketState: fut.marketState,
        capturadaEm: fut.regularMarketTime
          ? new Date(fut.regularMarketTime * 1000).toISOString()
          : fut.fetchedAt,
        centsBu: Math.round(centsBu * 100) / 100,
        usdBu: Math.round(usdBu * 10000) / 10000,
        brlSc60: brlSc60 != null ? Math.round(brlSc60 * 100) / 100 : null,
        brlTon: brlTon != null ? Math.round(brlTon * 100) / 100 : null,
        changePct: fut.changePct,
        changeAbs: changeAbsUsdBu != null ? Math.round(changeAbsUsdBu * 10000) / 10000 : null,
        previousClose: prevClose,
        highBu: highBu != null ? Math.round(highBu * 10000) / 10000 : null,
        lowBu: lowBu != null ? Math.round(lowBu * 10000) / 10000 : null,
        openBu: openBu != null ? Math.round(openBu * 10000) / 10000 : null,
      }
    })

    const cbotMarket = marketStatus('cbot')

    return NextResponse.json(
      {
        items,
        usdbrl: {
          price: fx.price,
          fonte: fx.fonte,
          capturadaEm: fx.capturadaEm,
          intraday: fx.intraday,
        },
        marketState: cbotMarket.state,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: { 'Cache-Control': 'private, max-age=20, stale-while-revalidate=60' },
      }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const status = msg === 'Não autorizado' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
