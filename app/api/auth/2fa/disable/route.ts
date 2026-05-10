/**
 * 2FA Disable — exige senha + código TOTP atual.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { compare } from 'bcryptjs'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { verifyTotp, consumeRecoveryCode } from '@/lib/auth/totp'
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

  let codeOk = false
  if (parsed.data.code && verifyTotp(user.totpSecret, parsed.data.code)) {
    codeOk = true
  } else if (parsed.data.recoveryCode) {
    const r = await consumeRecoveryCode(user.recoveryCodes, parsed.data.recoveryCode)
    codeOk = r.ok
  }
  if (!codeOk) {
    return NextResponse.json({ error: 'Código inválido' }, { status: 400 })
  }

  await db.user.update({
    where: { id: session.user.id },
    data: {
      totpSecret: null,
      totpEnabled: false,
      totpVerifiedAt: null,
      recoveryCodes: [],
    },
  })

  await logAudit({
    userId: session.user.id,
    acao: 'update',
    entidade: 'user',
    entidadeId: session.user.id,
    mudancas: { evento: '2fa_disabled' },
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
