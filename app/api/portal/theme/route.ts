/**
 * POST /api/portal/theme  { theme: 'light' | 'dark' }
 * Salva preferência em cookie (1 ano).
 */
import { NextRequest, NextResponse } from 'next/server'
import { PORTAL_THEME_COOKIE } from '@/lib/portal-produtor/theme'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const theme = body?.theme === 'dark' ? 'dark' : 'light'
  const res = NextResponse.json({ ok: true, theme })
  res.cookies.set(PORTAL_THEME_COOKIE, theme, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return res
}
