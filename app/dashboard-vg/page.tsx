import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { DashboardVgContent } from './_components/DashboardVgContent'

export const dynamic = 'force-dynamic'

/**
 * /dashboard-vg — versão experimental do dashboard com estética VisionGlass.
 *
 * Não substitui /dashboard. Rota paralela enquanto avaliamos a nova linguagem
 * visual. Reutiliza dados reais do workspace (nome, KPIs básicos) — não usa
 * mocks.
 */
export default async function DashboardVgPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const scope = await getScope()
  if (!scope) redirect('/auth/login')

  const [user, workspace, contratosAbertos, ofertasAtivas] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { nome: true, email: true },
    }),
    db.workspace.findUnique({
      where: { id: scope.workspaceId },
      select: { name: true, moedaPadrao: true },
    }),
    db.contrato.count({ where: { workspaceId: scope.workspaceId } }).catch(() => 0),
    db.oferta.count({ where: { workspaceId: scope.workspaceId, status: 'ativa' } }).catch(() => 0),
  ])

  const firstName =
    (user?.nome ?? '').split(' ')[0] ||
    (user?.email ?? '').split('@')[0] ||
    'Operador'

  return (
    <DashboardVgContent
      fullName={user?.nome ?? user?.email ?? 'Operador'}
      firstName={firstName}
      workspaceName={workspace?.name ?? 'Workspace'}
      contratosAbertos={contratosAbertos}
      ofertasAtivas={ofertasAtivas}
    />
  )
}
