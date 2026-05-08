/**
 * POST /api/cotacoes/sync
 *
 * Persiste snapshot de cotações no banco:
 *  - 3 linhas em Cotacao (soja/milho/trigo) em R$/sc 60kg, fonte='cepea'
 *  - 1 linha em TaxaCambio para USD/BRL, fonte='twelve-data'
 *
 * Idempotente: se já houver snapshot CEPEA do mesmo dia, NÃO duplica
 * (CEPEA atualiza diariamente — sentido em ter 1 row/dia/grão).
 *
 * Auth: Bearer ${CRON_SECRET}. Chamado por cron Railway 1x/dia (recomendado
 * 14h Brasília — após CEPEA publicar o fechamento).
 */
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db as prisma } from '@/lib/db'
import { fetchCepeaQuotes } from '@/lib/quotes/cepea'
import { fetchLiveQuote as fetchTwelveQuote } from '@/lib/quotes/twelvedata'

export const dynamic = 'force-dynamic'

const SIMBOLOS: Record<'soja' | 'milho' | 'trigo', string> = {
  soja: 'ZS',
  milho: 'ZC',
  trigo: 'ZW',
}

function startOfDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET || process.env.PRICE_SYNC_TOKEN || ''
  if (expected) {
    const auth = request.headers.get('Authorization') || ''
    if (!auth.startsWith('Bearer ') || auth.slice(7) !== expected) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('[cotacoes/sync] CRON_SECRET não setada — endpoint aberto')
  }

  try {
    const [cepea, usdbrlQ] = await Promise.all([
      fetchCepeaQuotes(['soja', 'milho', 'trigo']),
      fetchTwelveQuote('usdbrl'),
    ])

    const todayStart = startOfDay()
    const usdbrl = usdbrlQ.price
    const results: Record<string, any> = {}
    let persisted = 0

    for (const grain of ['soja', 'milho', 'trigo'] as const) {
      const q = cepea[grain]
      if (q.precoSc60 === null) {
        results[grain] = { skipped: true, reason: 'cepea offline' }
        continue
      }
      // Idempotência: 1 snapshot por dia
      const existing = await prisma.cotacao.findFirst({
        where: { grao: grain, fonte: 'cepea', data: { gte: todayStart } },
      })
      if (existing) {
        results[grain] = { skipped: true, reason: 'já persistido hoje', preco: q.precoSc60 }
        continue
      }
      await prisma.cotacao.create({
        data: {
          grao: grain,
          preco: new Prisma.Decimal(q.precoSc60),
          simbolo: SIMBOLOS[grain],
          fonte: 'cepea',
          dolarReal: usdbrl !== null ? new Prisma.Decimal(usdbrl) : null,
        },
      })
      persisted++
      results[grain] = { preco: q.precoSc60, dataRef: q.dataReferencia, persisted: true }
    }

    if (usdbrl !== null) {
      const existingFx = await prisma.taxaCambio.findFirst({
        where: { origem: 'USD', destino: 'BRL', data: { gte: todayStart } },
      })
      if (!existingFx) {
        await prisma.taxaCambio.create({
          data: {
            origem: 'USD',
            destino: 'BRL',
            taxa: new Prisma.Decimal(usdbrl),
            fonte: 'twelve-data',
          },
        })
        persisted++
      }
      results.usdbrl = { taxa: usdbrl, persisted: !existingFx }
    } else {
      results.usdbrl = { skipped: true, reason: 'twelve data offline' }
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
      { ok: false, error: error instanceof Error ? error.message : 'erro' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST para persistir snapshot CEPEA + USDBRL',
    method: 'POST',
    auth: 'Authorization: Bearer $CRON_SECRET',
  })
}
