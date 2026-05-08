import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { verifyTokenHash, isTokenExpired } from '@/lib/token-service'
import { checkRateLimit, getRemainingAttempts, getResetTime } from '@/lib/rate-limiter'

/**
 * GET /api/auth/verify-email?token=xxx
 * Verify email token and activate user account
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Token de verificação ausente' },
        { status: 400 }
      )
    }

    // Buscar token no banco
    const verificationTokenRecord = await db.emailVerificationToken.findFirst({
      where: {
        // Estamos procurando por um token que corresponda (verificamos o hash)
        // Como não podemos query por hash direto de forma segura, buscamos todos
        // e depois verificamos (em produção, seria melhor ter um índice)
      },
    })

    // Strategy: Buscar todos os tokens não expirados e verificar
    const allTokens = await db.emailVerificationToken.findMany({
      where: {
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    })

    let foundToken = null
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

    // Verificar se token já foi usado
    if (foundToken.user.emailVerificado) {
      return NextResponse.json(
        { error: 'Email já foi verificado' },
        { status: 400 }
      )
    }

    // Atualizar usuário e marcar como verificado
    await db.user.update({
      where: { id: foundToken.userId },
      data: {
        emailVerificado: true,
      },
    })

    // Deletar token usado
    await db.emailVerificationToken.delete({
      where: { id: foundToken.id },
    })

    return NextResponse.json({
      message: 'Email verificado com sucesso! Você pode fazer login.',
      redirect: '/auth/login',
    })
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.json(
      { error: 'Erro ao verificar email' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/auth/resend-verification
 * Resend verification email for unverified accounts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      )
    }

    // Rate limit: 3 attempts per hour per email
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
        { status: 429 } // Too Many Requests
      )
    }

    // Buscar usuário
    const user = await db.user.findUnique({
      where: { email },
    })

    if (!user) {
      // Não revelar se email existe
      return NextResponse.json({
        message: 'Se o email estiver registrado, um email de verificação foi enviado.',
      })
    }

    if (user.emailVerificado) {
      return NextResponse.json({
        message: 'Email já foi verificado.',
      })
    }

    // Deletar tokens antigos
    await db.emailVerificationToken.deleteMany({
      where: { userId: user.id },
    })

    // Gerar novo token
    const { generateToken, getTokenExpiry, hashToken } = await import('@/lib/token-service')
    const verificationToken = generateToken()
    const hashedToken = hashToken(verificationToken)
    const tokenExpiry = getTokenExpiry(24)

    // Criar novo token
    await db.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: hashedToken,
        expiresAt: tokenExpiry,
      },
    })

    // Enviar email
    const { sendEmail } = await import('@/lib/email-service')
    const verificationUrl = `${process.env.NEXTAUTH_URL}/auth/verify-email?token=${verificationToken}`

    await sendEmail({
      to: email,
      subject: '✉️ Verificar Email - PHB Grain',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Verificar seu Email</h2>
          <p style="color: #666; font-size: 16px;">
            Clique no link abaixo para verificar seu email e ativar sua conta.
          </p>

          <a href="${verificationUrl}"
             style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0; font-weight: bold;">
            Verificar Email
          </a>

          <p style="color: #999; font-size: 14px;">
            Ou copie e cole este link no navegador:<br/>
            <code style="background: #f0f0f0; padding: 8px; display: block; margin: 10px 0; word-break: break-all;">
              ${verificationUrl}
            </code>
          </p>

          <p style="color: #999; font-size: 14px;">
            Este link expira em 24 horas.
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            PHB Grain © ${new Date().getFullYear()}
          </p>
        </div>
      `,
    })

    return NextResponse.json({
      message: 'Email de verificação enviado com sucesso.',
    })
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { error: 'Erro ao enviar email de verificação' },
      { status: 500 }
    )
  }
}
