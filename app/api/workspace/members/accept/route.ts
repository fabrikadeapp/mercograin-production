import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { hash } from 'bcryptjs'
import { db } from '@/lib/db'
import { auth } from '@/auth'
import { validatePasswordStrength } from '@/lib/password-validator'
import { syncWorkspaceSeats } from '@/lib/stripe/seats'

export const dynamic = 'force-dynamic'

const schema = z.object({
  token: z.string().min(10),
  nome: z.string().min(2).optional(),
  senha: z.string().min(8).optional(),
})

/**
 * POST /api/workspace/members/accept
 *
 * Aceita um convite a partir do inviteToken. Dois caminhos:
 *  - Usuário logado com email igual ao do convite: vincula direto.
 *  - Usuário não logado e email sem User existente: cria User + vincula.
 *  - Usuário não logado mas email já tem User: pede login (retorna 409).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'invalid' },
      { status: 400 },
    )
  }
  const { token, nome, senha } = parsed.data

  const member = await db.workspaceMember.findFirst({
    where: { inviteToken: token, status: 'invited' },
    include: {
      workspace: { select: { id: true, name: true } },
    },
  })

  if (!member) {
    return NextResponse.json(
      { error: 'convite_invalido' },
      { status: 404 },
    )
  }

  // Expiração: 14 dias após invitedAt
  if (member.invitedAt) {
    const limite = new Date(member.invitedAt.getTime() + 14 * 24 * 3600 * 1000)
    if (Date.now() > limite.getTime()) {
      return NextResponse.json({ error: 'convite_expirado' }, { status: 410 })
    }
  }

  const session = await auth()

  // Caso 1: já logado com o email correto
  if (session?.user?.id && session.user.email?.toLowerCase() === member.email.toLowerCase()) {
    await db.workspaceMember.update({
      where: { id: member.id },
      data: {
        userId: session.user.id,
        status: 'active',
        acceptedAt: new Date(),
        inviteToken: null,
      },
    })
    await syncWorkspaceSeats(member.workspaceId).catch(() => null)
    return NextResponse.json({ ok: true, workspaceId: member.workspaceId })
  }

  // Logado com email diferente — não autorizado
  if (session?.user?.id) {
    return NextResponse.json(
      { error: 'email_diferente_do_convite' },
      { status: 403 },
    )
  }

  // Sem sessão: precisa criar/vincular User
  const existingUser = await db.user.findUnique({
    where: { email: member.email },
  })

  if (existingUser) {
    // Já tem conta no Mercograin — só falta logar e re-postar
    return NextResponse.json(
      { error: 'precisa_login', email: member.email },
      { status: 409 },
    )
  }

  if (!nome || !senha) {
    return NextResponse.json(
      { error: 'nome_e_senha_obrigatorios' },
      { status: 400 },
    )
  }

  const strength = validatePasswordStrength(senha)
  if (!strength.isValid) {
    return NextResponse.json(
      {
        error: 'Senha não atende aos critérios de segurança',
        feedback: strength.feedback,
      },
      { status: 400 },
    )
  }

  const hashed = await hash(senha, 10)
  const user = await db.user.create({
    data: {
      nome: nome.trim(),
      email: member.email,
      senha: hashed,
      emailVerificado: true, // o convite por email já valida o endereço
      role: 'user',
    },
  })

  await db.workspaceMember.update({
    where: { id: member.id },
    data: {
      userId: user.id,
      status: 'active',
      acceptedAt: new Date(),
      inviteToken: null,
    },
  })

  await syncWorkspaceSeats(member.workspaceId).catch(() => null)

  return NextResponse.json({ ok: true, workspaceId: member.workspaceId, userId: user.id })
}
