/**
 * /dashboard — dashboard da corretora logada.
 * Renderiza KPIs/inbox/preços/pipeline do workspace ativo respeitando
 * features e permissões (areasPermitidas) do usuário.
 *
 * Substitui o antigo /bhgrain (que era nome interno, agora redireciona aqui).
 */
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell } from '@/components/ui/phb'
import { BhGrainDashboard } from '@/app/bhgrain/_components/BhGrainDashboard'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const scope = await getScope()
  if (!scope) redirect('/auth/login')

  const [user, workspace] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { nome: true, email: true },
    }),
    db.workspace.findUnique({
      where: { id: scope.workspaceId },
      select: { name: true },
    }),
  ])

  const firstName =
    (user?.nome ?? '').split(' ')[0] ||
    (user?.email ?? '').split('@')[0] ||
    'Operador'

  return (
    <AppShell>
      <BhGrainDashboard
        firstName={firstName}
        workspaceName={workspace?.name ?? 'Workspace'}
      />
    </AppShell>
  )
}
