/**
 * Endpoint público que retorna se um e-mail tem 2FA TOTP habilitado.
 * Usado por formulários de login (modal SuperAdmin, /auth/login) pra
 * decidir se mostram o campo TOTP ANTES de tentar o signIn (que em
 * NextAuth v5 não expõe a cause do CredentialsSignin pro cliente).
 *
 * SEGURANÇA:
 * - Não revela se o e-mail existe (sempre retorna 200, totpEnabled false
 *   quando não encontra).
 * - Não revela secret nem nada sensível, só o boolean.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const email = (body.email || '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ totpEnabled: false })
  }

  const u = await db.user.findUnique({
    where: { email },
    select: { totpEnabled: true },
  })

  return NextResponse.json({ totpEnabled: !!u?.totpEnabled })
}
