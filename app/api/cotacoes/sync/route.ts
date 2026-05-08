/**
 * POST /api/cotacoes/sync
 * Persists current Yahoo Finance live quotes to the database.
 *  - Cotacao rows for soja/milho/trigo (preco in USD cents/bushel as Yahoo returns)
 *  - TaxaCambio row for USD/BRL
 *
 * Auth: Bearer ${CRON_SECRET}. Falls back to PRICE_SYNC_TOKEN for backward-compat.
 * If neither env is set, accepts any request but logs a warning in production.
 *
 * Designed to be triggered by a Railway cron job.
 */
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db as prisma } from '@/lib/db'
import { fetchAllLiveQuotes } from '@/lib/quotes/twelvedata'

export const dynamic = 'force-dynamic'

const SIMBOLOS: Record<'soja' | 'milho' | 'trigo', string> = {
  soja: 'ZS',
  milho: 'ZC',
  trigo: 'ZW',
}

export async function POST(request: NextRequest) {
  // Auth check
  const expected = process.env.CRON_SECRET || process.env.PRICE_SYNC_TOKEN || ''
  if (expected) {
    const auth = request.headers.get('Authorization') || ''
    if (!auth.startsWith('Bearer ') || auth.slice(7) !== expected) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('[cotacoes/sync] CRON_SECRET not set in production — endpoint is open!')
  }

  try {
    const quotes = await fetchAllLiveQuotes()
    const usdbrl = quotes.usdbrl.price

    let persisted = 0
    const results: Record<string, any> = {}

    // Grain quotes
    for (const grain of ['soja', 'milho', 'trigo'] as const) {
      const q = quotes[grain]
      if (q.price === null) {
        results[grain] = { skipped: true, reason: 'no price' }
        continue
      }
      await prisma.cotacao.create({
        data: {
          grao: grain,
          preco: new Prisma.Decimal(q.price),
          simbolo: SIMBOLOS[grain],
          fonte: 'twelve-data',
          dolarReal: usdbrl !== null ? new Prisma.Decimal(usdbrl) : null,
        },
      })
      persisted++
      results[grain] = { preco: q.price, persisted: true }
    }

    // FX
    if (usdbrl !== null) {
      await prisma.taxaCambio.create({
        data: {
          origem: 'USD',
          destino: 'BRL',
          taxa: new Prisma.Decimal(usdbrl),
          fonte: 'twelve-data',
        },
      })
      persisted++
      results.usdbrl = { taxa: usdbrl, persisted: true }
    } else {
      results.usdbrl = { skipped: true, reason: 'no rate' }
    }

    return NextResponse.json({
      ok: true,
      persisted,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cotacoes/sync] error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to sync Yahoo Finance quotes into Cotacao + TaxaCambio',
    method: 'POST',
    auth: 'Authorization: Bearer $CRON_SECRET',
  })
}
