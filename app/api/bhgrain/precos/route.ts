/**
 * GET /api/bhgrain/precos
 *
 * Cotações em **tempo real** combinando:
 *  - Spot BR (R$/sc): CEPEA/ESALQ (oficial venda firme, atualização diária)
 *  - Futuro CBOT (R$/sc convertido): Yahoo Finance ZS=F/ZC=F/ZW=F (tempo real <15min)
 *  - USD/BRL: AwesomeAPI / BCB PTAX (tempo real <1s)
 *
 * Conversão futuro CBOT cents/bushel → R$/sc 60kg:
 *   R$/sc60 = (cents/bu / 100) × USDBRL × (60 / 27.2155)
 *           = USD/bu × USDBRL × 2.20462
 *
 * Cache:
 *  - Yahoo: TTL 30s no yahoo-batch (frescor + load balance)
 *  - Spot CEPEA: TTL 5min (atualiza só uma vez por dia mesmo)
 *
 * Não chama nenhum fetch HTTP interno — usa imports diretos do projeto.
 */

import { NextResponse } from 'next/server'
import { requireScope } from '@/lib/auth/scope'
import { getQuotesBatch, type CommodityQuote } from '@/lib/commodities/yahoo-batch'
import { fetchCepeaQuotes } from '@/lib/quotes/cepea'
import { fetchFxBidAsk } from '@/lib/quotes/awesomeapi'
import { fetchBcbDolar } from '@/lib/quotes/bcb'
import { marketStatus } from '@/lib/quotes/market-hours'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// HTTP Cache: 15s no edge — frescor real-time mas evita storm
export const revalidate = 0

const FUTUROS = {
  soja: 'ZS=F',
  milho: 'ZC=F',
  trigo: 'ZW=F',
} as const

const BU_POR_SC60 = 60 / 27.2155 // ≈ 2.20462

type Grao = keyof typeof FUTUROS

interface PrecoCombinado {
  grao: Grao
  spot: {
    precoBrlSc: number | null
    fonte: string
    capturadaEm: string | null
    changePct: number | null
    marketState: string | null
  }
  futuro: {
    precoBrlSc: number | null
    precoUsdBu: number | null
    vencimento: string | null
    fonte: string
    changePct: number | null
    capturadaEm: string | null
    marketState: string | null
  }
}

interface UsdBrlSnap {
  price: number | null
  changePct: number | null
  fonte: string
  capturadaEm: string | null
}

async function getUsdBrlSnap(): Promise<UsdBrlSnap> {
  // Prioridade: AwesomeAPI (intraday bid/ask) → BCB PTAX (oficial)
  try {
    const fx = await fetchFxBidAsk('USD-BRL')
    if (fx?.bid != null && fx?.ask != null) {
      const mid = (Number(fx.bid) + Number(fx.ask)) / 2
      return {
        price: mid,
        changePct: fx.pctChange ?? null,
        fonte: 'AwesomeAPI · interbancário',
        capturadaEm: fx.timestamp ?? fx.fetchedAt ?? new Date().toISOString(),
      }
    }
  } catch {
    /* fallback */
  }
  try {
    const bcb = await fetchBcbDolar()
    if (bcb?.cotacaoVenda != null) {
      return {
        price: Number(bcb.cotacaoVenda),
        changePct: null,
        fonte: 'BCB · PTAX',
        capturadaEm: bcb.dataHoraCotacao ?? bcb.fetchedAt ?? new Date().toISOString(),
      }
    }
  } catch {
    /* ignore */
  }
  return { price: null, changePct: null, fonte: '—', capturadaEm: null }
}

async function getSpotCepea(): Promise<Partial<Record<Grao, { precoBrlSc: number | null; fonte: string; capturadaEm: string | null; changePct: number | null }>>> {
  try {
    const grains = await fetchCepeaQuotes(['soja', 'milho', 'trigo'])
    const map: Partial<Record<Grao, { precoBrlSc: number | null; fonte: string; capturadaEm: string | null; changePct: number | null }>> = {}
    for (const label of Object.keys(grains) as Grao[]) {
      const q = grains[label]
      if (!q) continue
      map[label] = {
        precoBrlSc: q.precoSc60,
        fonte: 'CEPEA · ESALQ',
        capturadaEm: q.fetchedAt ?? null,
        changePct: null, // CEPEA não dá variação intraday
      }
    }
    return map
  } catch {
    return {}
  }
}

function futuroBrl(fut: CommodityQuote | null, usdbrl: number | null): PrecoCombinado['futuro'] {
  if (!fut || fut.price == null) {
    return {
      precoBrlSc: null,
      precoUsdBu: null,
      vencimento: fut?.contractMonth ?? null,
      fonte: 'CBOT (Yahoo)',
      changePct: fut?.changePct ?? null,
      capturadaEm: fut?.fetchedAt ?? null,
      marketState: fut?.marketState ?? null,
    }
  }
  // Yahoo retorna cents/bushel para ZS/ZC/ZW. Convertendo:
  const usdBu = fut.price / 100
  const brlSc = usdbrl != null ? usdBu * usdbrl * BU_POR_SC60 : null
  return {
    precoBrlSc: brlSc != null ? Math.round(brlSc * 100) / 100 : null,
    precoUsdBu: Math.round(usdBu * 100) / 100,
    vencimento: fut.contractMonth,
    fonte: fut.exchangeName ?? 'CBOT (Yahoo)',
    changePct: fut.changePct,
    capturadaEm: fut.regularMarketTime ? new Date(fut.regularMarketTime * 1000).toISOString() : fut.fetchedAt,
    marketState: fut.marketState,
  }
}

export async function GET() {
  try {
    await requireScope()

    // Tudo em paralelo: 3 fontes independentes
    const [futQuotes, spotMap, usdbrl] = await Promise.all([
      getQuotesBatch(Object.values(FUTUROS)),
      getSpotCepea(),
      getUsdBrlSnap(),
    ])

    const ptaxStatus = marketStatus('ptax')
    const cbotStatus = marketStatus('cbot')

    const grains: PrecoCombinado[] = (Object.keys(FUTUROS) as Grao[]).map((grao) => {
      const fut = futQuotes[FUTUROS[grao]]
      const spot = spotMap[grao]
      return {
        grao,
        spot: spot
          ? {
              precoBrlSc: spot.precoBrlSc,
              fonte: spot.fonte,
              capturadaEm: spot.capturadaEm,
              changePct: spot.changePct,
              marketState: null,
            }
          : {
              precoBrlSc: null,
              fonte: 'CEPEA indisponível',
              capturadaEm: null,
              changePct: null,
              marketState: null,
            },
        futuro: futuroBrl(fut ?? null, usdbrl.price),
      }
    })

    return NextResponse.json(
      {
        grains,
        usdbrl: {
          ...usdbrl,
          marketState: ptaxStatus.state,
        },
        marketStates: {
          ptax: ptaxStatus.state,
          cbot: cbotStatus.state,
        },
        fetchedAt: new Date().toISOString(),
      },
      {
        // Cache 30s alinhado ao TTL interno do yahoo-batch.
        // s-maxage permite cache em proxy/edge entre usuários do mesmo workspace.
        // stale-while-revalidate evita flicker em race conditions.
        headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
      }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const status = msg === 'Não autorizado' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
