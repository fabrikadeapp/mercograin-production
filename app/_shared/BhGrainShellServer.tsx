import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { BhGrainShell } from '@/app/bhgrain/_components/BhGrainShell'

/**
 * Wrapper server-side do BhGrainShell. Carrega session/scope/membership e
 * monta o shell unificado das 4 áreas (Mesa/Financeiro/Fiscal/Gestão).
 *
 * Use em todas as páginas que devem ter o topbar unificado.
 * Não use junto com AppShell (são alternativos).
 */
export async function BhGrainShellServer({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const [user, workspace, membership] = await Promise.all([
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
      {children}
    </BhGrainShell>
  )
}
