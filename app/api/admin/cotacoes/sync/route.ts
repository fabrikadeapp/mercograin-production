import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchCepeaQuotes } from '@/lib/quotes/cepea'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'
import { rateLimit } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

const SYMBOLS: Record<'soja' | 'milho' | 'trigo', string> = {
  soja: 'ZS',
  milho: 'ZC',
  trigo: 'ZW',
}

export async function POST() {
  try {
    const admin = await requireAdmin()

    // Throttle global: dispara fetch externo (CEPEA) + inserts. No máx. 1/min.
    const limit = rateLimit('admin:cotacoes-sync', 1, 60_000)
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Aguarde antes de sincronizar novamente.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(limit.resetIn / 1000)) },
        }
      )
    }

    const quotes = await fetchCepeaQuotes(['soja', 'milho', 'trigo'])
    const created: string[] = []
    for (const label of ['soja', 'milho', 'trigo'] as const) {
      const q = quotes[label]
      if (!q?.precoSc60) continue
      const c = await db.cotacao.create({
        data: {
          grao: label,
          preco: q.precoSc60.toFixed(2),
          simbolo: SYMBOLS[label],
          fonte: 'CEPEA',
        },
      })
      created.push(c.id)
    }
    await db.auditLog.create({
      data: {
        userId: admin.id,
        acao: 'admin_force_cotacao_sync',
        entidade: 'cotacao',
        entidadeId: created.join(',') || 'none',
        mudancas: { count: created.length },
      },
    })
    return NextResponse.json({ ok: true, created: created.length, quotes })
  } catch (e) {
    return adminErrorResponse(e)
  }
}
