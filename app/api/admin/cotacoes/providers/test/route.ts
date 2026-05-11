/**
 * POST /api/admin/cotacoes/providers/test
 * Roda ping() em cada provider e retorna status + latência.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { listProviders } from '@/lib/quotes/registry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const u = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (u?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const providers = listProviders()
  const results = await Promise.all(
    providers.map(async (p) => {
      const res = await p.ping().catch((e) => ({
        ok: false,
        message: e?.message || 'erro inesperado',
      }))
      return {
        id: p.id,
        displayName: p.displayName,
        supports: p.supports,
        isConfigured: p.isConfigured(),
        ...res,
      }
    }),
  )
  return NextResponse.json({ results })
}
