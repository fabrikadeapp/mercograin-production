import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { validatePasswordStrength } from '@/lib/password-validator'

const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Token inválido'),
    password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
    passwordConfirm: z.string().optional(),
  })
  .refine((data) => !data.passwordConfirm || data.password === data.passwordConfirm, {
    message: 'As senhas não correspondem',
    path: ['passwordConfirm'],
  })

function getIp(request: NextRequest): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  )
}

/**
 * GET /api/auth/reset-password?token=xxx
 * Valida o token (sem consumir).
 */
export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get('token')
    if (!token) {
      return NextResponse.json({ valid: false, error: 'Token ausente' }, { status: 400 })
    }
    const record = await db.passwordResetToken.findUnique({
      where: { token },
      include: { user: { select: { email: true } } },
    })
    if (!record) {
      return NextResponse.json({ valid: false, error: 'Token inválido' }, { status: 400 })
    }
    if (record.expiresAt < new Date()) {
      await db.passwordResetToken.delete({ where: { id: record.id } }).catch(() => {})
      return NextResponse.json({ valid: false, error: 'Link expirou' }, { status: 400 })
    }
    return NextResponse.json({ valid: true, email: record.user.email })
  } catch (error) {
    console.error('[Auth] reset-password GET error:', error)
    return NextResponse.json({ valid: false, error: 'Erro ao validar token' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = resetPasswordSchema.parse(body)

    // Força mínima da senha
    const strength = validatePasswordStrength(data.password)
    if (!strength.isValid) {
      return NextResponse.json(
        { error: 'Senha não atende aos critérios de segurança', feedback: strength.feedback },
        { status: 400 }
      )
    }

    const resetToken = await db.passwordResetToken.findUnique({
      where: { token: data.token },
      include: { user: true },
    })

    if (!resetToken) {
      return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 400 })
    }

    if (resetToken.expiresAt < new Date()) {
      await db.passwordResetToken.delete({ where: { id: resetToken.id } }).catch(() => {})
      return NextResponse.json({ error: 'Link expirou. Solicite um novo' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(data.password, 10)

    await db.user.update({
      where: { id: resetToken.userId },
      data: { senha: hashedPassword },
    })

    // Invalida o token usado + qualquer outro token pendente do mesmo user
    await db.passwordResetToken.deleteMany({ where: { userId: resetToken.userId } })

    try {
      await db.auditLog.create({
        data: {
          userId: resetToken.userId,
          acao: 'password.reset',
          entidade: 'User',
          entidadeId: resetToken.userId,
          mudancas: { method: 'reset_token' },
          ipAddress: getIp(request),
          userAgent: request.headers.get('user-agent') || null,
        },
      })
    } catch (e) {
      console.error('[auth] auditLog falhou (reset-password):', e)
    }

    return NextResponse.json({
      ok: true,
      message: 'Senha alterada com sucesso! Você pode fazer login agora.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('[Auth] Reset password error:', error)
    return NextResponse.json({ error: 'Erro ao resetar senha' }, { status: 500 })
  }
}
