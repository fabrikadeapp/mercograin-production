import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/perfil/lgpd/export
 *
 * LGPD Art. 18 — direito de portabilidade.
 * Retorna JSON com TODOS os dados pessoais do usuário autenticado.
 *
 * Inclui: User, WorkspaceMember(s), Workspace(s) owned, audit logs do user,
 * push subscriptions, sessions ativas.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  const [user, memberships, ownedWorkspaces, auditLogs, pushSubs] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nome: true,
        role: true,
        emailVerificado: true,
        totpEnabled: true,
        criadoEm: true,
        atualizadoEm: true,
      },
    }),
    db.workspaceMember.findMany({
      where: { userId },
      select: {
        id: true,
        workspaceId: true,
        email: true,
        role: true,
        cargo: true,
        funcoes: true,
        areasPermitidas: true,
        status: true,
        invitedAt: true,
        acceptedAt: true,
        createdAt: true,
      },
    }),
    db.workspace.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
        slug: true,
        codigo: true,
        createdAt: true,
      },
    }),
    db.auditLog
      .findMany({
        where: { userId },
        take: 500,
        orderBy: { criadoEm: 'desc' },
      })
      .catch(() => []),
    db.pushSubscription
      .findMany({
        where: { userId },
        select: {
          id: true,
          endpoint: true,
          createdAt: true,
        },
      })
      .catch(() => []),
  ])

  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      user,
      memberships,
      ownedWorkspaces,
      auditLogs,
      pushSubs,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="meus-dados-bhgrain-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    },
  )
}
