import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { verifyTokenHash, generateToken, getTokenExpiry, hashToken } from '@/lib/token-service'
import { checkRateLimit, getRemainingAttempts, getResetTime } from '@/lib/rate-limiter'
import { sendEmail } from '@/lib/email-service'
import { verifyEmailEmail, welcomeEmail } from '@/lib/email/templates'

function getIp(request: NextRequest): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  )
}

/**
 * GET /api/auth/verify-email?token=xxx
 * Valida o token de verificação e ativa a conta.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token de verificação ausente' }, { status: 400 })
    }

    // Tokens são armazenados como hash sha256. Buscamos os ativos e comparamos.
    const allTokens = await db.emailVerificationToken.findMany({
      where: { expiresAt: { gt: new Date() } },
      include: { user: true },
    })

    let foundToken: (typeof allTokens)[number] | null = null
    for (const t of allTokens) {
      if (verifyTokenHash(token, t.token)) {
        foundToken = t
        break
      }
    }

    if (!foundToken) {
      return NextResponse.json(
        { error: 'Token de verificação inválido ou expirado' },
        { status: 400 }
      )
    }

    if (foundToken.user.emailVerificado) {
      // Garante limpeza
      await db.emailVerificationToken.delete({ where: { id: foundToken.id } }).catch(() => {})
      return NextResponse.json({ error: 'Email já foi verificado' }, { status: 400 })
    }

    await db.user.update({
      where: { id: foundToken.userId },
      data: { emailVerificado: true },
    })

    await db.emailVerificationToken.deleteMany({ where: { userId: foundToken.userId } })

    // Audit
    try {
      await db.auditLog.create({
        data: {
          userId: foundToken.userId,
          acao: 'email.verified',
          entidade: 'User',
          entidadeId: foundToken.userId,
          ipAddress: getIp(request),
          userAgent: request.headers.get('user-agent') || null,
        },
      })
    } catch (e) {
      console.error('[auth] auditLog falhou (verify-email):', e)
    }

    // Welcome email (best-effort, não bloqueia resposta em caso de erro)
    try {
      const tpl = welcomeEmail({ name: foundToken.user.nome })
      await sendEmail({
        to: foundToken.user.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      })
    } catch (e) {
      console.error('[auth] welcome email falhou:', e)
    }

    return NextResponse.json({
      ok: true,
      message: 'Email verificado com sucesso! Você pode fazer login.',
      redirect: '/auth/login?verified=1',
    })
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.json({ error: 'Erro ao verificar email' }, { status: 500 })
  }
}

/**
 * POST /api/auth/verify-email
 * Reenviar email de verificação. Body: { email }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 })
    }

    const rateLimitKey = `resend-verification:${email}`
    if (!checkRateLimit(rateLimitKey, 3, 3600000)) {
      const remaining = getRemainingAttempts(rateLimitKey, 3, 3600000)
      const resetSeconds = getResetTime(rateLimitKey)
      return NextResponse.json(
        {
          error: `Muitas tentativas. Tente novamente em ${resetSeconds} segundo(s).`,
          remainingAttempts: remaining,
          resetIn: resetSeconds,
        },
        { status: 429 }
      )
    }

    const user = await db.user.findUnique({ where: { email } })

    // Resposta genérica em todos os casos não-positivos
    const generic = NextResponse.json({
      message: 'Se o email estiver registrado, um email de verificação foi enviado.',
    })
    if (!user) return generic
    if (user.emailVerificado) {
      return NextResponse.json({ message: 'Email já foi verificado.' })
    }

    await db.emailVerificationToken.deleteMany({ where: { userId: user.id } })

    const verificationToken = generateToken()
    const hashedToken = hashToken(verificationToken)
    const tokenExpiry = getTokenExpiry(24)

    await db.emailVerificationToken.create({
      data: { userId: user.id, token: hashedToken, expiresAt: tokenExpiry },
    })

    const baseUrl = process.env.NEXTAUTH_URL || 'https://www.profitsync.ia.br'
    const verifyUrl = `${baseUrl}/auth/verify-email?token=${verificationToken}`

    const tpl = verifyEmailEmail({ name: user.nome, verifyUrl })
    const result = await sendEmail({
      to: email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    })

    try {
      await db.auditLog.create({
        data: {
          userId: user.id,
          acao: 'email.verification_resent',
          entidade: 'User',
          entidadeId: user.id,
          mudancas: { provider: result.provider, ok: result.ok, skipped: result.skipped ?? false },
          ipAddress: getIp(request),
          userAgent: request.headers.get('user-agent') || null,
        },
      })
    } catch (e) {
      console.error('[auth] auditLog falhou (resend-verification):', e)
    }

    return NextResponse.json({ message: 'Email de verificação enviado com sucesso.' })
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json({ error: 'Erro ao enviar email de verificação' }, { status: 500 })
  }
}
