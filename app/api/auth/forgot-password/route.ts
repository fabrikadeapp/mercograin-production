import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email-service'
import { resetPasswordEmail } from '@/lib/email/templates'
import { z } from 'zod'
import crypto from 'crypto'
import { rateLimit, getClientIp } from '@/lib/security/rate-limit'

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
})

function getIp(request: NextRequest): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  )
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 3 tentativas/hora por IP — protege contra abuso de envio de emails.
    const ip = getClientIp(request)
    const limit = rateLimit(`forgot-password:${ip}`, 3, 60 * 60 * 1000)
    if (!limit.ok) {
      const minutes = Math.ceil(limit.resetIn / 60000)
      // Audit best-effort (sem userId pois ainda não autenticado).
      // AuditLog requer userId, então logamos apenas em console.
      console.warn(`[auth] forgot-password rate limit exceeded for IP ${ip}`)
      return NextResponse.json(
        { error: `Muitas tentativas. Tente novamente em ${minutes} min.` },
        { status: 429 },
      )
    }

    const body = await request.json()
    const { email } = forgotPasswordSchema.parse(body)

    const user = await db.user.findUnique({ where: { email } })

    // Sempre responde ok pra não revelar existência do email
    const genericResponse = NextResponse.json({
      ok: true,
      message: 'Se este email existir, você receberá um link para recuperar a senha.',
    })

    if (!user) return genericResponse

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1h

    // Invalida tokens anteriores
    await db.passwordResetToken.deleteMany({ where: { userId: user.id } })

    await db.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    })

    const baseUrl = process.env.NEXTAUTH_URL || 'https://www.profitsync.ia.br'
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`

    const tpl = resetPasswordEmail({ name: user.nome, resetUrl })
    const result = await sendEmail({
      to: email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    })

    // Audit log (best-effort)
    try {
      await db.auditLog.create({
        data: {
          userId: user.id,
          acao: 'password.reset_requested',
          entidade: 'User',
          entidadeId: user.id,
          mudancas: { provider: result.provider, ok: result.ok, skipped: result.skipped ?? false },
          ipAddress: getIp(request),
          userAgent: request.headers.get('user-agent') || null,
        },
      })
    } catch (e) {
      console.error('[auth] auditLog falhou (forgot-password):', e)
    }

    return genericResponse
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('[Auth] Forgot password error:', error)
    return NextResponse.json({ error: 'Erro ao processar solicitação' }, { status: 500 })
  }
}
