/**
 * POST /api/portal/auth/reset
 * Body: { email, token, novaSenha }
 * Consome ProdutorPasswordReset não-usado/não-expirado.
 */
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword, setSessionCookie } from '@/lib/portal-produtor/auth'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  email: z.string().email(),
  token: z.string().min(20),
  novaSenha: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'precisa maiúscula')
    .regex(/[a-z]/, 'precisa minúscula')
    .regex(/\d/, 'precisa número'),
})

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }
  const access = await db.produtorAccess.findFirst({
    where: { emailLogin: parsed.data.email.toLowerCase() },
    orderBy: { ultimoLogin: 'desc' },
  })
  if (!access || !access.ativo) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 400 })
  }

  // Procura o reset válido mais recente
  const candidatos = await db.produtorPasswordReset.findMany({
    where: {
      produtorAccessId: access.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  let usado: { id: string } | null = null
  for (const c of candidatos) {
    if (await bcrypt.compare(parsed.data.token, c.tokenHash)) {
      usado = c
      break
    }
  }
  if (!usado) {
    return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 400 })
  }

  const passwordHash = await hashPassword(parsed.data.novaSenha)
  await db.$transaction([
    db.produtorAccess.update({
      where: { id: access.id },
      data: { passwordHash, ultimoLogin: new Date() },
    }),
    db.produtorPasswordReset.update({
      where: { id: usado.id },
      data: { usedAt: new Date() },
    }),
    // invalida todos os outros tokens pendentes desse access
    db.produtorPasswordReset.updateMany({
      where: {
        produtorAccessId: access.id,
        usedAt: null,
        id: { not: usado.id },
      },
      data: { usedAt: new Date() },
    }),
  ])

  const res = NextResponse.json({ ok: true })
  await setSessionCookie(res, {
    workspaceId: access.workspaceId,
    clienteId: access.clienteId,
    accessId: access.id,
  })
  await logAudit({
    userId: 'portal-produtor',
    workspaceId: access.workspaceId,
    acao: 'password_reset',
    entidade: 'ProdutorAccess',
    entidadeId: access.id,
  }).catch(() => undefined)
  return res
}
