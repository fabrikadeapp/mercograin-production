/**
 * 2FA Setup
 * GET  → cria secret em sessão (ainda NÃO salva no User), retorna otpauth URI + QR base64
 * POST → recebe { secret, code }, valida código, ativa totpEnabled e gera recovery codes
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import QRCode from 'qrcode'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import {
  generateTotpSecret,
  buildTotpUri,
  verifyTotp,
  generateRecoveryCodes,
  hashRecoveryCodes,
} from '@/lib/auth/totp'
import { logAudit } from '@/lib/audit/log'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, totpEnabled: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }
  if (user.totpEnabled) {
    return NextResponse.json(
      { error: '2FA já está ativo. Desative antes de reconfigurar.' },
      { status: 400 }
    )
  }

  const secret = generateTotpSecret()
  const otpauthUri = buildTotpUri(user.email, secret)
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri, { width: 256 })

  return NextResponse.json({
    secret,
    otpauthUri,
    qrCodeBase64: qrCodeDataUrl, // formato data:image/png;base64,...
  })
}

const postSchema = z.object({
  secret: z.string().min(16),
  code: z.string().regex(/^\d{6}$/),
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
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const { secret, code } = parsed.data
  if (!verifyTotp(secret, code)) {
    return NextResponse.json(
      { error: 'Código inválido. Verifique o relógio do dispositivo.' },
      { status: 400 }
    )
  }

  const recoveryCodes = generateRecoveryCodes(10)
  const hashed = await hashRecoveryCodes(recoveryCodes)

  await db.user.update({
    where: { id: session.user.id },
    data: {
      totpSecret: secret,
      totpEnabled: true,
      totpVerifiedAt: new Date(),
      recoveryCodes: hashed,
    },
  })

  await logAudit({
    userId: session.user.id,
    acao: 'update',
    entidade: 'user',
    entidadeId: session.user.id,
    mudancas: { evento: '2fa_enabled' },
  }).catch(() => {})

  return NextResponse.json({
    success: true,
    recoveryCodes, // mostrados apenas 1x — usuário deve salvar
  })
}
