/**
 * GET /api/cotacoes/live
 *
 * Cotações ao vivo combinando duas fontes:
 *  - CEPEA/ESALQ (R$/sc 60kg, à vista BR oficial) para Soja/Milho/Trigo
 *  - Twelve Data (USD/BRL câmbio + sparklines diárias dos ETFs proxy)
 *
 * Retorno mantém o contrato consumido pelo dashboard (LiveQuotePayload):
 * preço em R$/sc para os grãos, R$ para USD/BRL.
 *
 * Edge-cached 5 min (CEPEA atualiza diariamente; pra UX dá sensação de vivo
 * sem martelar o widget). USD/BRL refresca em paralelo a cada hit.
 */
import { NextResponse } from 'next/server'
import { fetchCepeaQuotes, type CepeaLabel } from '@/lib/quotes/cepea'
import {
  fetchLiveQuote as fetchTwelveQuote,
  fetchSparkline as fetchTwelveSparkline,
} from '@/lib/quotes/twelvedata'
import { fetchFxBidAsk } from '@/lib/quotes/awesomeapi'
import { fetchBcbDolar } from '@/lib/quotes/bcb'
import { marketStatus } from '@/lib/quotes/market-hours'
import { db as prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const TON_TO_SC60 = 1000 / 60
const GRAINS: CepeaLabel[] = ['soja', 'milho', 'trigo']

// Cache em memória — frequência máxima permitida pelas fontes gratuitas:
//   Twelve Data: 8 req/min free (USDBRL atualiza ~tempo-real durante pregão)
//   CEPEA: 1 atualização/dia oficial (após fechamento ~14h-15h Brasília)
interface MemCache<T> { data: T | null; at: number }
const TTL_USDBRL = 30_000   // 30s — Twelve Data USDBRL (mais frescor)
const TTL_CEPEA  = 300_000  // 5min — CEPEA atualiza só 1x/dia, mas refresh evita widget timeout
const TTL_SPARK  = 3600_000 // 1h
const usdbrlCache: MemCache<Awaited<ReturnType<typeof fetchTwelveQuote>>> = { data: null, at: 0 }
const sparkCache: MemCache<number[]> = { data: null, at: 0 }
const cepeaCache: MemCache<Awaited<ReturnType<typeof fetchCepeaQuotes>>> = { data: null, at: 0 }

async function getCepeaCached() {
  const now = Date.now()
  if (cepeaCache.data && now - cepeaCache.at < TTL_CEPEA) return cepeaCache.data
  const fresh = await fetchCepeaQuotes(GRAINS)
  // Só cacheia se pelo menos 1 grão veio com preço — evita cachear vazio
  const anyPrice = Object.values(fresh).some((q) => q.precoSc60 !== null)
  if (anyPrice) {
    cepeaCache.data = fresh
    cepeaCache.at = now
    return fresh
  }
  if (cepeaCache.data) return cepeaCache.data  // serve stale se temos
  return fresh  // tudo vazio
}

async function getUsdbrlCached() {
  const now = Date.now()
  // Cache fresco — retorna direto
  if (usdbrlCache.data && now - usdbrlCache.at < TTL_USDBRL) return usdbrlCache.data

  // 1) PRIMÁRIA: BCB PTAX (oficial brasileira, sem rate limit pra IPs cloud)
  const bcb = await fetchBcbDolar()
  if (bcb.cotacaoCompra !== null && bcb.cotacaoVenda !== null) {
    const mid = (bcb.cotacaoCompra + bcb.cotacaoVenda) / 2
    const fresh = {
      symbol: 'USD/BRL',
      label: 'usdbrl' as const,
      price: mid,
      open: null,
      high: bcb.cotacaoVenda,
      low: bcb.cotacaoCompra,
      previousClose: null,
      changeAbs: null,
      changePct: null,
      currency: 'BRL',
      exchangeName: 'BCB · PTAX',
      marketState: 'open' as const,
      fetchedAt: bcb.fetchedAt,
    }
    usdbrlCache.data = fresh as any
    usdbrlCache.at = now
    return fresh as any
  }

  // 2) FALLBACK: AwesomeAPI (caso BCB caia)
  const fx = await fetchFxBidAsk('USD-BRL')
  if (fx.bid !== null && fx.ask !== null) {
    const mid = (fx.bid + fx.ask) / 2
    const prevMid = fx.bid && fx.varBid !== null ? mid - fx.varBid : null
    const fresh = {
      symbol: 'USD/BRL',
      label: 'usdbrl' as const,
      price: mid,
      open: prevMid,
      high: fx.high,
      low: fx.low,
      previousClose: prevMid,
      changeAbs: fx.varBid,
      changePct: fx.pctChange,
      currency: 'BRL',
      exchangeName: 'AwesomeAPI · interbancário',
      marketState: 'open' as const,
      fetchedAt: fx.fetchedAt,
    }
    usdbrlCache.data = fresh as any
    usdbrlCache.at = now
    return fresh as any
  }

  // 3) FALLBACK Twelve Data
  const td = await fetchTwelveQuote('usdbrl')
  if (td.price !== null) {
    usdbrlCache.data = td
    usdbrlCache.at = now
    return td
  }

  // 4) Cache stale
  if (usdbrlCache.data) return usdbrlCache.data

  // 5) Tudo vazio — retorna empty (NÃO fabrica número errado)
  return td
}

async function getUsdbrlSparkCached(): Promise<number[]> {
  const now = Date.now()
  if (sparkCache.data && now - sparkCache.at < TTL_SPARK) return sparkCache.data
  const fresh = await fetchTwelveSparkline('usdbrl').catch(() => [] as number[])
  if (fresh.length > 0) {
    sparkCache.data = fresh
    sparkCache.at = now
  }
  return fresh
}

function emptyPayload(label: 'soja' | 'milho' | 'trigo' | 'usdbrl', symbol: string, currency: string) {
  return {
    symbol,
    label,
    price: null,
    open: null,
    high: null,
    low: null,
    previousClose: null,
    changeAbs: null,
    changePct: null,
    currency,
    exchangeName: null,
    marketState: null,
    fetchedAt: new Date().toISOString(),
    sparkline: [] as number[],
  }
}

/**
 * Carrega últimos N preços do Cotacao para gerar sparkline em R$/sc.
 * Garante que mesmo com poucos snapshots o gráfico tem alguma forma.
 */
async function getCepeaSparkline(grao: CepeaLabel, limit = 30): Promise<number[]> {
  try {
    const rows = await prisma.cotacao.findMany({
      where: { grao, fonte: 'cepea' },
      orderBy: { data: 'desc' },
      take: limit,
      select: { preco: true },
    })
    return rows
      .map((r) => Number(r.preco))
      .filter(Number.isFinite)
      .reverse()
  } catch {
    return []
  }
}

export async function GET() {
  const fetchedAt = new Date().toISOString()
  try {
    const [cepea, usdbrlTD, sparkSoja, sparkMilho, sparkTrigo, sparkUsdbrl] =
      await Promise.all([
        getCepeaCached(),
        getUsdbrlCached(),
        // Sparkline em R$/sc. Se DB ainda não tem histórico, retorna vazio.
        getCepeaSparkline('soja'),
        getCepeaSparkline('milho'),
        getCepeaSparkline('trigo'),
        getUsdbrlSparkCached(),
      ])

    // Para cada grão: tenta calcular previousClose a partir do penúltimo
    // ponto da sparkline (R$/sc no caso CEPEA, USD no fallback).
    function buildGrain(
      label: CepeaLabel,
      symbolDisplay: string,
      sparkline: number[],
    ) {
      const c = cepea[label]
      if (c.precoSc60 !== null) {
        const prev = sparkline.length >= 2 ? sparkline[sparkline.length - 2] : null
        const cepeaStatus = marketStatus('cepea')
        // Δ% só faz sentido durante pregão. Mercado fechado → mostra preço de
        // fechamento sem variação intraday (que ficaria zerada/errada).
        const changeAbs = cepeaStatus.open && prev !== null ? c.precoSc60 - prev : null
        const changePct =
          cepeaStatus.open && prev !== null && prev !== 0
            ? ((c.precoSc60 - prev) / prev) * 100
            : null
        return {
          symbol: symbolDisplay,
          label,
          price: c.precoSc60,
          open: null,
          high: null,
          low: null,
          previousClose: prev,
          changeAbs,
          changePct,
          currency: 'BRL',
          exchangeName: 'CEPEA · ESALQ',
          marketState: cepeaStatus.state,
          marketReason: cepeaStatus.reason || null,
          nextOpen: cepeaStatus.nextOpen || null,
          fetchedAt: c.fetchedAt,
          sparkline,
          // metadados extras (consumidos opcionalmente pelo card)
          cepea: {
            indicatorId: c.indicatorId,
            displayName: c.displayName,
            precoBruto: c.precoBruto,
            unidadeBruta: c.unidadeBruta,
            dataReferencia: c.dataReferencia,
          },
        }
      }
      // Fallback: vazio. Frontend mostra chip OFFLINE.
      return emptyPayload(label, symbolDisplay, 'BRL')
    }

    const soja = buildGrain('soja', 'CEPEA · ZS', sparkSoja)
    const milho = buildGrain('milho', 'CEPEA · ZC', sparkMilho)
    const trigo = buildGrain('trigo', 'CEPEA · ZW', sparkTrigo)

    // USD/BRL — usa BCB PTAX como primário (já dentro de getUsdbrlCached)
    // Fim de semana / fora de horário: zera changePct (não há variação intraday)
    const ptaxStatus = marketStatus('ptax')
    const usdbrl = {
      symbol: 'USD/BRL',
      label: 'usdbrl' as const,
      price: usdbrlTD.price,
      open: ptaxStatus.open ? usdbrlTD.open : null,
      high: usdbrlTD.high,
      low: usdbrlTD.low,
      previousClose: usdbrlTD.previousClose,
      // Δ só faz sentido durante pregão. Fora dele, mostra fechamento estável.
      changeAbs: ptaxStatus.open ? usdbrlTD.changeAbs : null,
      changePct: ptaxStatus.open ? usdbrlTD.changePct : null,
      currency: usdbrlTD.currency || 'BRL',
      exchangeName: usdbrlTD.exchangeName,
      marketState: ptaxStatus.state,
      marketReason: ptaxStatus.reason || null,
      nextOpen: ptaxStatus.nextOpen || null,
      fetchedAt: usdbrlTD.fetchedAt,
      sparkline: sparkUsdbrl,
    }

    return NextResponse.json(
      {
        soja,
        milho,
        trigo,
        usdbrl,
        source: 'cepea+twelve-data',
        fetchedAt,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (e: any) {
    console.error('[cotacoes/live] error:', e?.message || e)
    return NextResponse.json(
      { error: e?.message || 'live quotes failed' },
      { status: 500 }
    )
  }
}
