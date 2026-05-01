import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  passwordConfirm: z.string(),
}).refine(data => data.password === data.passwordConfirm, {
  message: 'As senhas não correspondem',
  path: ['passwordConfirm'],
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = resetPasswordSchema.parse(body)

    // Buscar token
    const resetToken = await db.passwordResetToken.findUnique({
      where: { token: data.token },
      include: { user: true },
    })

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 400 }
      )
    }

    // Verificar expiração
    if (resetToken.expiresAt < new Date()) {
      await db.passwordResetToken.delete({
        where: { id: resetToken.id },
      })

      return NextResponse.json(
        { error: 'Link expirou. Solicite um novo' },
        { status: 400 }
      )
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(data.password, 10)

    // Atualizar usuário
    await db.user.update({
      where: { id: resetToken.userId },
      data: {
        senha: hashedPassword,
      },
    })

    // Deletar token
    await db.passwordResetToken.delete({
      where: { id: resetToken.id },
    })

    console.log(`[Auth] Senha resetada para ${resetToken.user.email}`)

    return NextResponse.json({
      ok: true,
      message: 'Senha alterada com sucesso! Você pode fazer login agora.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('[Auth] Reset password error:', error)
    return NextResponse.json(
      { error: 'Erro ao resetar senha' },
      { status: 500 }
    )
  }
}
