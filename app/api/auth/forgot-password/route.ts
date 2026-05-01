import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, emailTemplates } from '@/lib/email-service'
import { z } from 'zod'
import crypto from 'crypto'

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = forgotPasswordSchema.parse(body)

    // Buscar usuário
    const user = await db.user.findUnique({
      where: { email },
    })

    if (!user) {
      // Não revelar se usuário existe (segurança)
      return NextResponse.json({
        ok: true,
        message: 'Se este email existir, você receberá um link para recuperar a senha.',
      })
    }

    // Gerar token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000) // 1 hora

    // Deletar tokens antigos
    await db.passwordResetToken.deleteMany({
      where: { userId: user.id },
    })

    // Criar novo token
    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    })

    // Enviar email
    const emailData = emailTemplates.resetPassword(token, user.nome)
    await sendEmail({
      to: email,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
    })

    console.log(`[Auth] Token de reset enviado para ${email}`)

    return NextResponse.json({
      ok: true,
      message: 'Se este email existir, você receberá um link para recuperar a senha.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('[Auth] Forgot password error:', error)
    return NextResponse.json(
      { error: 'Erro ao processar solicitação' },
      { status: 500 }
    )
  }
}
