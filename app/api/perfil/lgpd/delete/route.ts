import { NextResponse } from 'next/server'
import { z } from 'zod'
import { compare } from 'bcryptjs'
import { auth, signOut } from '@/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const schema = z.object({
  /** Senha atual confirmação — proteção contra deletion acidental */
  senha: z.string().min(1),
  /** Frase de confirmação literal */
  confirmacao: z.literal('EXCLUIR MINHA CONTA'),
})

/**
 * POST /api/perfil/lgpd/delete
 *
 * LGPD Art. 18 — direito ao esquecimento.
 * Anonimiza o User e remove dados pessoais. Mantém audit logs (compliance)
 * mas sem PII associada.
 *
 * Não permite deletion se user é único owner de workspace ativo —
 * precisa transferir ownership antes.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'invalid' },
      { status: 400 },
    )
  }

  // Confirma senha
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { senha: true, email: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const ok = await compare(parsed.data.senha, user.senha)
  if (!ok) {
    return NextResponse.json({ error: 'senha_incorreta' }, { status: 403 })
  }

  // Verifica se é único owner de workspace
  const ownedWorkspaces = await db.workspace.findMany({
    where: { ownerId: session.user.id },
    select: { id: true, name: true },
  })
  if (ownedWorkspaces.length > 0) {
    return NextResponse.json(
      {
        error: 'transferir_ownership_primeiro',
        message:
          'Você é dono de ' +
          ownedWorkspaces.length +
          ' workspace(s). Transfira a propriedade antes de excluir sua conta.',
        workspaces: ownedWorkspaces,
      },
      { status: 409 },
    )
  }

  // Anonimização: substitui PII por valores genéricos
  const anonEmail = `deleted-${Date.now()}@deleted.local`
  await db.user.update({
    where: { id: session.user.id },
    data: {
      email: anonEmail,
      nome: 'Usuário Excluído',
      senha: 'DELETED_NO_LOGIN_POSSIBLE',
      emailVerificado: false,
      totpEnabled: false,
      totpSecret: null,
      recoveryCodes: [],
      stripeCustomerId: null,
    },
  })

  // Remove push subscriptions
  await db.pushSubscription.deleteMany({ where: { userId: session.user.id } })

  // Marca memberships como desativados
  await db.workspaceMember.updateMany({
    where: { userId: session.user.id },
    data: { status: 'suspended' },
  })

  await signOut({ redirectTo: '/auth/login?excluido=true' })

  return NextResponse.json({ ok: true })
}
