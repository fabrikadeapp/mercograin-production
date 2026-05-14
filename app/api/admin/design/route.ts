/**
 * GET /api/admin/design     → { theme }
 * PUT /api/admin/design     → body { theme }, retorna { ok, theme }
 *
 * Restrito a User.role === 'admin' (superadmin global).
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { getUiTheme, setUiTheme, type UiTheme } from '@/lib/ui/theme'

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
  const theme = await getUiTheme()
  return NextResponse.json({ theme })
}

export async function PUT(req: NextRequest) {
  const u = await requireSuperAdmin()
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = (await req.json().catch(() => null)) as { theme?: string } | null
  if (!body || body.theme !== 'phb') {
    return NextResponse.json({ error: 'invalid_theme' }, { status: 400 })
  }

  await setUiTheme(body.theme as UiTheme, u.email ?? u.id)
  return NextResponse.json({ ok: true, theme: body.theme })
}
