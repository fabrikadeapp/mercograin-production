import { hash } from 'bcryptjs'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateToken, getTokenExpiry, hashToken } from '@/lib/token-service'
import { sendEmail as sendLegacyEmail } from '@/lib/email-service'
import { verifyEmailEmail } from '@/lib/email/templates'
import { sendEmail } from '@/lib/email/send'
import { welcomeTemplate } from '@/lib/email/templates/welcome'
import { validatePasswordStrength } from '@/lib/password-validator'
import { rateLimit, getClientIp } from '@/lib/security/rate-limit'
import { logAudit } from '@/lib/audit/log'

const signupSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email: z.string().email('Email inválido'),
  senha: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
})

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 signups/hora por IP — protege contra criação massiva de contas.
    const ip = getClientIp(request)
    const limit = rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000)
    if (!limit.ok) {
      const minutes = Math.ceil(limit.resetIn / 60000)
      console.warn(`[auth] signup rate limit exceeded for IP ${ip}`)
      return NextResponse.json(
        { error: `Muitas tentativas. Tente novamente em ${minutes} min.` },
        { status: 429 },
      )
    }

    const body = await request.json()

    const { nome, email, senha } = signupSchema.parse(body)

    // Validate password strength
    const passwordStrength = validatePasswordStrength(senha)
    if (!passwordStrength.isValid) {
      return NextResponse.json(
        {
          error: 'Senha não atende aos critérios de segurança',
          feedback: passwordStrength.feedback,
        },
        { status: 400 }
      )
    }

    // Verificar se usuário já existe
    const existingUser = await db.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: existingUser.emailVerificado ? 'Email já registrado' : 'Email já registrado. Verifique sua caixa de entrada.' },
        { status: 400 }
      )
    }

    // Hash da senha
    const hashedPassword = await hash(senha, 10)

    // Gerar token de verificação
    const verificationToken = generateToken()
    const hashedToken = hashToken(verificationToken)
    const tokenExpiry = getTokenExpiry(24) // 24 horas

    // Criar usuário com email não verificado
    const user = await db.user.create({
      data: {
        nome,
        email,
        senha: hashedPassword,
        emailVerificado: false,
        emailVerificationTokens: {
          create: {
            token: hashedToken,
            expiresAt: tokenExpiry,
          },
        },
      },
    })

    // QW2 — audit log signup (workspaceId null pois user ainda não tem ws)
    await logAudit({
      userId: user.id,
      workspaceId: null,
      acao: 'signup',
      entidade: 'user',
      entidadeId: user.id,
      mudancas: { email: user.email, nome: user.nome },
    })

    // Enviar email de verificação (best-effort)
    try {
      const baseUrl = process.env.NEXTAUTH_URL || 'https://www.profitsync.ia.br'
      const verifyUrl = `${baseUrl}/auth/verify-email?token=${verificationToken}`
      const tpl = verifyEmailEmail({ name: nome, verifyUrl })
      await sendLegacyEmail({
        to: email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      })
    } catch (emailError) {
      console.error('Error sending verification email:', emailError)
      // Continua mesmo com falha — usuário pode reenviar via /auth/resend-verification
    }

    // Welcome email (best-effort) — separado do verify para que falha de um não impeça o outro.
    try {
      const tpl = welcomeTemplate({ name: nome })
      await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text })
    } catch (welcomeError) {
      console.error('Error sending welcome email:', welcomeError)
    }

    return NextResponse.json(
      {
        message: 'Conta criada! Verifique seu email para ativar.',
        user: { id: user.id, email: user.email, nome: user.nome },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Erro ao criar conta' }, { status: 500 })
  }
}
