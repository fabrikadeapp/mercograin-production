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
import { db as prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 300  // 5 min — CEPEA atualiza diariamente

const TON_TO_SC60 = 1000 / 60
const GRAINS: CepeaLabel[] = ['soja', 'milho', 'trigo']

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
    const [cepea, usdbrlTD, sparkSoja, sparkMilho, sparkTrigo] = await Promise.all([
      fetchCepeaQuotes(GRAINS),
      fetchTwelveQuote('usdbrl'),
      // Sparkline em R$/sc. Se DB ainda não tem histórico, retorna vazio.
      // Não cai em fallback Twelve Data porque seria USD (escala diferente).
      getCepeaSparkline('soja'),
      getCepeaSparkline('milho'),
      getCepeaSparkline('trigo'),
    ])

    const sparkUsdbrl = await fetchTwelveSparkline('usdbrl').catch(() => [])

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
        const changeAbs = prev !== null ? c.precoSc60 - prev : null
        const changePct =
          prev !== null && prev !== 0 ? ((c.precoSc60 - prev) / prev) * 100 : null
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
          marketState: 'open',
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

    // USD/BRL via Twelve Data
    const usdbrl = {
      symbol: 'USD/BRL',
      label: 'usdbrl' as const,
      price: usdbrlTD.price,
      open: usdbrlTD.open,
      high: usdbrlTD.high,
      low: usdbrlTD.low,
      previousClose: usdbrlTD.previousClose,
      changeAbs: usdbrlTD.changeAbs,
      changePct: usdbrlTD.changePct,
      currency: usdbrlTD.currency || 'BRL',
      exchangeName: usdbrlTD.exchangeName,
      marketState: usdbrlTD.marketState,
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
