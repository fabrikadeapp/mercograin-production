/**
 * GET   /api/admin/leads          → lista leads (filtro opcional ?status= ?q=)
 * PATCH /api/admin/leads/[id]     → atualiza status / observação
 *
 * Acesso: User.role === 'admin' (super-admin).
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function requireSuperAdmin() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = session?.user as any
  if (!u?.id || u.role !== 'admin') return null
  return u
}

export async function GET(req: NextRequest) {
  const u = await requireSuperAdmin()
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const sp = new URL(req.url).searchParams
  const status = sp.get('status') ?? undefined
  const q = sp.get('q')?.toLowerCase().trim()
  const leads = await db.lead.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { nomeCompleto: { contains: q, mode: 'insensitive' } },
              { cpfCnpj: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      origemWorkspace: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  const counts = await db.lead.groupBy({
    by: ['status'],
    _count: { _all: true },
  })
  return NextResponse.json({ ok: true, leads, counts })
}
