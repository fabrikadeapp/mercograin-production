/**
 * GET    /api/admin/cotacoes/providers          → lê config atual + lista providers
 * PUT    /api/admin/cotacoes/providers          → atualiza config (primary, fallbacks, cacheMinutes)
 * POST   /api/admin/cotacoes/providers/test     → ping em todos os providers
 *
 * Restrito a User.role === 'admin' (superadmin global).
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import {
  getQuotesConfig,
  setQuotesConfig,
  listProviders,
} from '@/lib/quotes/registry'
import type { ProviderId, QuotesConfig } from '@/lib/quotes/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function requireSuperAdmin() {
  const session = await auth()
  if (!session?.user?.id) return null
  const u = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, id: true, email: true },
  })
  if (u?.role !== 'admin') return null
  return u
}

export async function GET() {
  const u = await requireSuperAdmin()
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const config = await getQuotesConfig()
  const providers = listProviders().map((p) => ({
    id: p.id,
    displayName: p.displayName,
    supports: p.supports,
    isConfigured: p.isConfigured(),
  }))
  return NextResponse.json({ config, providers })
}

export async function PUT(req: NextRequest) {
  const u = await requireSuperAdmin()
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = (await req.json().catch(() => null)) as Partial<QuotesConfig> | null
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })

  const validIds = listProviders().map((p) => p.id) as ProviderId[]
  if (!validIds.includes(body.primary as ProviderId)) {
    return NextResponse.json({ error: 'invalid_primary' }, { status: 400 })
  }
  const fallbacks = (body.fallbacks ?? []).filter((x) =>
    validIds.includes(x as ProviderId),
  ) as ProviderId[]

  const next: QuotesConfig = {
    primary: body.primary as ProviderId,
    fallbacks,
    cacheMinutes:
      typeof body.cacheMinutes === 'number' && body.cacheMinutes >= 0
        ? body.cacheMinutes
        : 5,
  }

  await setQuotesConfig(next, u.email ?? u.id)
  return NextResponse.json({ ok: true, config: next })
}
