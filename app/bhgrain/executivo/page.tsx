import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { BhGrainShell } from '../_components/BhGrainShell'
import { DashboardExecutivo } from './_components/DashboardExecutivo'

export const dynamic = 'force-dynamic'

/**
 * /bhgrain/executivo — dashboard de visão executiva (visão de dono).
 *
 * Foco em decisão estratégica:
 *   - Mês atual × mês anterior
 *   - Tendência 6 meses (receita e hit rate)
 *   - Hit rate por canal (qual canal converte melhor?)
 *   - Top clientes (concentração de receita)
 *   - Funil (gargalos do processo)
 */
export default async function DashboardExecutivoPage() {
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
      <DashboardExecutivo workspaceName={workspace?.name ?? 'Workspace'} />
    </BhGrainShell>
  )
}
