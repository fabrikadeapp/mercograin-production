/**
 * GET /api/cotacoes/book?grao=soja|milho|trigo|usdbrl[&all=1]
 *
 * Retorna best-bid e best-ask para cada grão/câmbio:
 *
 * Para grãos:
 *   1) BID (compra): MAIOR preço dentre Propostas com tipo='compra' e
 *      status enviada|aceita do user (quem está disposto a pagar mais por sc).
 *   2) ASK (venda): MENOR preço dentre Propostas com tipo='venda' e
 *      status enviada|aceita (quem está oferecendo o sc mais barato).
 *   3) Quando vazio: fallback estimado (CEPEA spot ± spread típico).
 *
 * Para usdbrl: AwesomeAPI bid/ask em tempo real (sem fallback).
 *
 * Por padrão escopa por User. Admin com ?all=1 vê toda a base.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { fetchFxBidAsk } from '@/lib/quotes/awesomeapi'
import { fetchCepeaQuote, type CepeaLabel } from '@/lib/quotes/cepea'

export const dynamic = 'force-dynamic'

type Grao = 'soja' | 'milho' | 'trigo'
type Symbol = Grao | 'usdbrl'

// Spread típico de mercado quando não há propostas reais (estimativa)
const FALLBACK_SPREAD_PCT: Record<Grao, number> = {
  soja:  0.5,   // 0.5% — soja é líquida
  milho: 0.8,
  trigo: 1.0,
}

interface BookSide {
  price: number | null
  source: string                  // 'PROP-2841 · Cliente X' | 'estimado · CEPEA'
  /** Se true, dado real (proposta sua); false = estimativa */
  real: boolean
  propostaId?: string
  clienteNome?: string
}

interface BookResponse {
  symbol: Symbol
  bid: BookSide
  ask: BookSide
  mid: number | null
  spread: number | null
  spreadPct: number | null
  unidade: string
  fonte: string
  fetchedAt: string
}

function fallbackBookGrain(grao: Grao, spotPrice: number): { bid: BookSide; ask: BookSide } {
  const spread = (FALLBACK_SPREAD_PCT[grao] / 100) * spotPrice
  const half = spread / 2
  return {
    bid: {
      price: Math.round((spotPrice - half) * 100) / 100,
      source: 'Estimado · CEPEA',
      real: false,
    },
    ask: {
      price: Math.round((spotPrice + half) * 100) / 100,
      source: 'Estimado · CEPEA',
      real: false,
    },
  }
}

export async function GET(req: NextRequest) {
  try {
    const scope = await getScope(new URL(req.url).searchParams)
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const symbol = (searchParams.get('grao') || searchParams.get('symbol') || 'soja').toLowerCase() as Symbol
    if (!['soja', 'milho', 'trigo', 'usdbrl'].includes(symbol)) {
      return NextResponse.json({ error: 'symbol inválido' }, { status: 400 })
    }
    const fetchedAt = new Date().toISOString()

    // === USDBRL via AwesomeAPI ===
    if (symbol === 'usdbrl') {
      const fx = await fetchFxBidAsk('USD-BRL')
      const out: BookResponse = {
        symbol,
        bid: {
          price: fx.bid,
          source: 'AwesomeAPI · interbancário',
          real: fx.bid !== null,
        },
        ask: {
          price: fx.ask,
          source: 'AwesomeAPI · interbancário',
          real: fx.ask !== null,
        },
        mid: fx.bid !== null && fx.ask !== null ? (fx.bid + fx.ask) / 2 : null,
        spread: fx.spread,
        spreadPct: fx.spreadPct,
        unidade: 'BRL/USD',
        fonte: 'AwesomeAPI',
        fetchedAt,
      }
      return NextResponse.json(out, {
        headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60' },
      })
    }

    // === Grãos: scopa pelo user (admin pode ?scope=all)
    const grao = symbol as Grao
    const scopedWhere = scope.whereOwn({})

    // Busca propostas ativas do user com graos relevantes
    const propostas = await db.proposta.findMany({
      where: {
        ...scopedWhere,
        status: { in: ['enviada', 'aceita'] },
      },
      include: { cliente: { select: { nome: true } } },
      take: 200,
      orderBy: { criadaEm: 'desc' },
    })

    // Filtra grãos no JSON.graos[] e pega o melhor preço por tipo
    let bestBid: BookSide = { price: null, source: '', real: false }
    let bestAsk: BookSide = { price: null, source: '', real: false }

    for (const p of propostas) {
      const items = Array.isArray(p.graos) ? (p.graos as any[]) : []
      const matching = items.find((it) => String(it?.grao || '').toLowerCase() === grao)
      if (!matching || !Number.isFinite(Number(matching.preco))) continue
      const preco = Number(matching.preco)

      if (p.tipo === 'compra') {
        // bid: maior preço de compra (cliente disposto a pagar mais)
        if (bestBid.price === null || preco > bestBid.price) {
          bestBid = {
            price: Math.round(preco * 100) / 100,
            source: `${p.numero} · ${p.cliente?.nome || 'Cliente'}`,
            real: true,
            propostaId: p.id,
            clienteNome: p.cliente?.nome,
          }
        }
      } else if (p.tipo === 'venda') {
        // ask: menor preço de venda
        if (bestAsk.price === null || preco < bestAsk.price) {
          bestAsk = {
            price: Math.round(preco * 100) / 100,
            source: `${p.numero} · ${p.cliente?.nome || 'Cliente'}`,
            real: true,
            propostaId: p.id,
            clienteNome: p.cliente?.nome,
          }
        }
      }
    }

    // Fallback: pega CEPEA spot e gera bid/ask sintético
    let spotPrice: number | null = null
    if (bestBid.price === null || bestAsk.price === null) {
      const cepea = await fetchCepeaQuote(grao as CepeaLabel)
      spotPrice = cepea.precoSc60
      if (spotPrice !== null) {
        const fb = fallbackBookGrain(grao, spotPrice)
        if (bestBid.price === null) bestBid = fb.bid
        if (bestAsk.price === null) bestAsk = fb.ask
      }
    }

    const bid = bestBid.price
    const ask = bestAsk.price
    const mid = bid !== null && ask !== null ? (bid + ask) / 2 : null
    const spread = bid !== null && ask !== null ? ask - bid : null
    const spreadPct = spread !== null && mid !== null && mid > 0 ? (spread / mid) * 100 : null

    const fonte =
      bestBid.real && bestAsk.real ? 'Suas propostas (PHB Grain)' :
      bestBid.real ? 'Compra: PHB Grain · Venda: estimado CEPEA' :
      bestAsk.real ? 'Compra: estimado CEPEA · Venda: PHB Grain' :
      'Estimado · CEPEA'

    const out: BookResponse = {
      symbol,
      bid: bestBid,
      ask: bestAsk,
      mid: mid !== null ? Math.round(mid * 100) / 100 : null,
      spread: spread !== null ? Math.round(spread * 100) / 100 : null,
      spreadPct: spreadPct !== null ? Math.round(spreadPct * 100) / 100 : null,
      unidade: 'R$/sc 60kg',
      fonte,
      fetchedAt,
    }

    return NextResponse.json(out, {
      headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' },
    })
  } catch (e: any) {
    console.error('GET /cotacoes/book error:', e?.message || e)
    return NextResponse.json({ error: e?.message || 'erro' }, { status: 500 })
  }
}
