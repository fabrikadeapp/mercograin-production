import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchCepeaQuotes } from '@/lib/quotes/cepea'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

const SYMBOLS: Record<'soja' | 'milho' | 'trigo', string> = {
  soja: 'ZS',
  milho: 'ZC',
  trigo: 'ZW',
}

export async function POST() {
  try {
    const admin = await requireAdmin()
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
