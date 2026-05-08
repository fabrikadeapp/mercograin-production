/**
 * GET /api/pricing — endpoint público.
 * Retorna planos ativos + features ordenados pra landing/precos.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { loadActivePlans } from '@/lib/pricing/serialize'

export const dynamic = 'force-dynamic'
export const revalidate = 60

export async function GET() {
  try {
    const [plans, rev] = await Promise.all([
      loadActivePlans(),
      db.pricingRevision.findUnique({ where: { id: 1 } }),
    ])

    return NextResponse.json(
      {
        plans,
        revision: rev?.revision ?? 1,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
        },
      }
    )
  } catch (err) {
    console.error('[api/pricing] erro:', err)
    return NextResponse.json(
      { error: 'internal_error', plans: [], revision: 0 },
      { status: 500 }
    )
  }
}
