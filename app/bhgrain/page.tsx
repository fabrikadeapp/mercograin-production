import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { BhGrainShell } from './_components/BhGrainShell'
import { BhGrainDashboard } from './_components/BhGrainDashboard'

export const dynamic = 'force-dynamic'

/**
 * /bhgrain — dashboard BH Grain dedicado.
 *
 * Layout 2-linhas conforme prompt master:
 *   Linha 1: Clientes · Inbox · Preços · Propostas
 *   Linha 2: Pipeline · Indicadores · Faturamento & Meta
 *
 * Topbar dedicada (BhGrainShell) com logo BH azul + menu mínimo.
 */
export default async function BhGrainPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const scope = await getScope()
  if (!scope) redirect('/auth/login')

  const [user, workspace] = await Promise.all([
    db.user.findUnique({ where: { id: session.user.id }, select: { nome: true, email: true } }),
    db.workspace.findUnique({ where: { id: scope.workspaceId }, select: { name: true } }),
  ])

  const firstName =
    (user?.nome ?? '').split(' ')[0] || (user?.email ?? '').split('@')[0] || 'Operador'

  return (
    <BhGrainShell userName={user?.nome ?? user?.email ?? null} workspaceName={workspace?.name ?? null}>
      <BhGrainDashboard firstName={firstName} workspaceName={workspace?.name ?? 'Workspace'} />
    </BhGrainShell>
  )
}
