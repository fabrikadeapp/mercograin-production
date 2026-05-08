import { hash } from 'bcryptjs'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateToken, getTokenExpiry, hashToken } from '@/lib/token-service'
import { sendEmail, emailTemplates } from '@/lib/email-service'
import { validatePasswordStrength } from '@/lib/password-validator'

const signupSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email: z.string().email('Email inválido'),
  senha: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
})

export async function POST(request: NextRequest) {
  try {
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

    // Enviar email de verificação
    try {
      const verificationUrl = `${process.env.NEXTAUTH_URL}/auth/verify-email?token=${verificationToken}`
      await sendEmail({
        to: email,
        subject: '✉️ Verificar Email - PHB Grain',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Bem-vindo ao PHB Grain, ${nome}!</h2>
            <p style="color: #666; font-size: 16px;">
              Sua conta foi criada com sucesso. Clique no link abaixo para verificar seu email e ativar sua conta.
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

            <p style="color: #999; font-size: 14px;">
              Se você não criou esta conta, ignore este email.
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">
              PHB Grain © ${new Date().getFullYear()}
            </p>
          </div>
        `,
        text: `Bem-vindo ao PHB Grain, ${nome}!\n\nClique aqui para verificar seu email:\n${verificationUrl}\n\nEste link expira em 24 horas.`,
      })
    } catch (emailError) {
      console.error('Error sending verification email:', emailError)
      // Continue mesmo se o email falhar - usuário pode tentar reenviar depois
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
