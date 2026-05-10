/**
 * 2FA Verify (standalone) — endpoint utilitário para validar um código TOTP
 * sem completar login. Útil pra confirmações sensíveis (mudança de senha,
 * desabilitar 2FA, regenerar recovery codes).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { verifyTotp, consumeRecoveryCode } from '@/lib/auth/totp'

const schema = z.object({
  code: z.string().optional(),
  recoveryCode: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success || (!parsed.data.code && !parsed.data.recoveryCode)) {
    return NextResponse.json({ error: 'Código requerido' }, { status: 400 })
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecret: true, totpEnabled: true, recoveryCodes: true },
  })
  if (!user || !user.totpEnabled || !user.totpSecret) {
    return NextResponse.json({ error: '2FA não ativo' }, { status: 400 })
  }

  if (parsed.data.code && verifyTotp(user.totpSecret, parsed.data.code)) {
    return NextResponse.json({ valid: true, method: 'totp' })
  }

  if (parsed.data.recoveryCode) {
    const result = await consumeRecoveryCode(
      user.recoveryCodes,
      parsed.data.recoveryCode
    )
    if (result.ok) {
      await db.user.update({
        where: { id: session.user.id },
        data: { recoveryCodes: result.remaining },
      })
      return NextResponse.json({
        valid: true,
        method: 'recovery',
        remaining: result.remaining.length,
      })
    }
  }

  return NextResponse.json({ valid: false }, { status: 400 })
}
