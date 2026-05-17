import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { BhGrainShell } from '@/app/bhgrain/_components/BhGrainShell'
import { EquipeManager } from './_components/EquipeManager'

export const dynamic = 'force-dynamic'

export default async function EquipePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const scope = await getScope()
  if (!scope) redirect('/auth/login')

  // Gate: owner / admin do workspace (ou admin global)
  if (
    !scope.isAdmin &&
    scope.workspaceRole !== 'owner' &&
    scope.workspaceRole !== 'admin'
  ) {
    redirect('/sem-acesso')
  }

  const [user, workspace, membership, members] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { nome: true, email: true, role: true },
    }),
    db.workspace.findUnique({
      where: { id: scope.workspaceId },
      select: { name: true },
    }),
    db.workspaceMember.findFirst({
      where: { workspaceId: scope.workspaceId, userId: session.user.id },
      select: { role: true, areasPermitidas: true },
    }),
    db.workspaceMember.findMany({
      where: { workspaceId: scope.workspaceId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        cargo: true,
        funcoes: true,
        areasPermitidas: true,
        invitedAt: true,
        acceptedAt: true,
        createdAt: true,
        user: { select: { id: true, nome: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  return (
    <BhGrainShell
      userName={user?.nome ?? user?.email ?? null}
      workspaceName={workspace?.name ?? null}
      userEmail={user?.email ?? null}
      userRole={user?.role ?? null}
      workspaceRole={membership?.role ?? null}
      areasPermitidas={membership?.areasPermitidas ?? null}
    >
      <EquipeManager initialMembers={members as any} />
    </BhGrainShell>
  )
}
