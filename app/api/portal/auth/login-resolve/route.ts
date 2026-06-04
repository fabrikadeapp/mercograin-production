/**
 * POST /api/portal/auth/login-resolve
 * Body: { email, senha, accessId }
 *
 * Etapa 2 do login multi-corretora: cliente escolheu uma das corretoras.
 * Re-valida email + senha + accessId e seta cookie de sessão.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { verifyPassword, setSessionCookie } from '@/lib/portal-produtor/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
  accessId: z.string().min(8),
})

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const access = await db.produtorAccess.findUnique({
    where: { id: parsed.data.accessId },
    include: { workspace: { select: { slug: true } } },
  })
  if (
    !access ||
    !access.ativo ||
    !access.passwordHash ||
    access.emailLogin !== parsed.data.email.toLowerCase().trim()
  ) {
    return NextResponse.json({ error: 'credenciais_invalidas' }, { status: 401 })
  }
  const ok = await verifyPassword(parsed.data.senha, access.passwordHash)
  if (!ok) {
    return NextResponse.json({ error: 'credenciais_invalidas' }, { status: 401 })
  }
  await db.produtorAccess
    .update({ where: { id: access.id }, data: { ultimoLogin: new Date() } })
    .catch(() => undefined)
  const res = NextResponse.json({ ok: true, slug: access.workspace.slug })
  await setSessionCookie(res, {
    workspaceId: access.workspaceId,
    clienteId: access.clienteId,
    accessId: access.id,
  })
  return res
}
