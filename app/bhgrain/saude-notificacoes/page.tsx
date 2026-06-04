import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { BhGrainShell } from '../_components/BhGrainShell'
import { SaudeNotificacoesView } from './_components/SaudeNotificacoesView'

export const dynamic = 'force-dynamic'

/**
 * /bhgrain/saude-notificacoes — dashboard de saúde das notificações.
 * Visibilidade pra equipe que precisa diagnosticar entregabilidade.
 */
export default async function SaudeNotificacoesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')

  const [user, workspace, membership] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { nome: true, email: true, role: true },
    }),
    db.workspace.findUnique({ where: { id: scope.workspaceId }, select: { name: true } }),
    db.workspaceMember.findFirst({
      where: { workspaceId: scope.workspaceId, userId: session.user.id },
      select: { role: true, areasPermitidas: true },
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
      <SaudeNotificacoesView />
    </BhGrainShell>
  )
}
