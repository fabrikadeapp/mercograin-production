import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell } from '@/components/ui/phb'
import { MemberPerformance } from './_components/MemberPerformance'

export const dynamic = 'force-dynamic'

export default async function MemberPage({
  params,
}: {
  params: { memberId: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const scope = await getScope()
  if (!scope) redirect('/auth/login')

  if (
    !scope.isAdmin &&
    scope.workspaceRole !== 'owner' &&
    scope.workspaceRole !== 'admin'
  ) {
    redirect('/sem-acesso')
  }

  const [user, workspace, membership, member] = await Promise.all([
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
    db.workspaceMember.findFirst({
      where: { id: params.memberId, workspaceId: scope.workspaceId },
      select: {
        id: true,
        email: true,
        cargo: true,
        role: true,
        funcoes: true,
        areasPermitidas: true,
        user: { select: { nome: true } },
      },
    }),
  ])

  if (!member) notFound()

  return (
    <AppShell>
      <MemberPerformance memberId={member.id} memberName={member.user?.nome ?? member.email} />
    </AppShell>
  )
}
