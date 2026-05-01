/**
 * GET /api/cotacoes/live
 * Fetch live commodity prices from Investing.com
 * Returns: soja, milho, trigo prices in USD cents/bushel
 * Also returns exchange rate USD/BRL for conversion
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getSoybeanPrice,
  getCornPrice,
  getWheatPrice,
  getExchangeRate,
  getGrainPrices,
} from '@/lib/investing-client'

export async function GET(request: NextRequest) {
  try {
    // Check if user requested a specific grain
    const { searchParams } = new URL(request.url)
    const grain = searchParams.get('grain')?.toLowerCase()

    let priceData: any = {}

    if (grain === 'soja') {
      priceData.soja = await getSoybeanPrice()
    } else if (grain === 'milho') {
      priceData.milho = await getCornPrice()
    } else if (grain === 'trigo') {
      priceData.trigo = await getWheatPrice()
    } else if (grain === 'taxa-cambio') {
      priceData.taxaCambio = await getExchangeRate()
    } else {
      // Get all prices if no specific grain requested
      priceData = await getGrainPrices()
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      data: priceData,
      note: 'Preços em USD cents/bushel (soja, milho, trigo). Taxa em USD/BRL.',
      source: 'Investing.com web scraping',
    })
  } catch (error) {
    console.error('Error fetching live prices:', error)
    return NextResponse.json(
      {
        error: 'Erro ao buscar cotações ao vivo',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
