/**
 * Regenera os 10 recovery codes do usuário (invalida os anteriores).
 * Requer senha + TOTP/recovery atual.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { compare } from 'bcryptjs'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import {
  verifyTotp,
  consumeRecoveryCode,
  generateRecoveryCodes,
  hashRecoveryCodes,
} from '@/lib/auth/totp'
import { logAudit } from '@/lib/audit/log'

const schema = z.object({
  password: z.string().min(1),
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
    return NextResponse.json({ error: 'Senha e código requeridos' }, { status: 400 })
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { senha: true, totpSecret: true, totpEnabled: true, recoveryCodes: true },
  })
  if (!user || !user.totpEnabled || !user.totpSecret) {
    return NextResponse.json({ error: '2FA não ativo' }, { status: 400 })
  }

  const passwordOk = await compare(parsed.data.password, user.senha)
  if (!passwordOk) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 400 })
  }

  let ok = false
  if (parsed.data.code && verifyTotp(user.totpSecret, parsed.data.code)) {
    ok = true
  } else if (parsed.data.recoveryCode) {
    const r = await consumeRecoveryCode(user.recoveryCodes, parsed.data.recoveryCode)
    ok = r.ok
  }
  if (!ok) {
    return NextResponse.json({ error: 'Código inválido' }, { status: 400 })
  }

  const newCodes = generateRecoveryCodes(10)
  const hashed = await hashRecoveryCodes(newCodes)
  await db.user.update({
    where: { id: session.user.id },
    data: { recoveryCodes: hashed },
  })

  await logAudit({
    userId: session.user.id,
    acao: 'update',
    entidade: 'user',
    entidadeId: session.user.id,
    mudancas: { evento: '2fa_recovery_regenerated' },
  }).catch(() => {})

  return NextResponse.json({ success: true, recoveryCodes: newCodes })
}
