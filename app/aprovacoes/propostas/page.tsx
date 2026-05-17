import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import {
  resolveMesaScope,
  wherePropostaMesa,
} from '@/lib/equipe/scope-mesa'
import { BhGrainShell } from '@/app/bhgrain/_components/BhGrainShell'
import { PropostasAutorizacaoBoard } from './_components/PropostasAutorizacaoBoard'

export const dynamic = 'force-dynamic'

export default async function PropostasAutorizacaoPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const mesa = await resolveMesaScope(scope)
  const mesaFilter = wherePropostaMesa(mesa)

  const where: any = {
    ...scope.whereOwn(),
    status: 'aguardando_autorizacao',
  }
  if (mesaFilter && Object.keys(mesaFilter).length > 0) {
    where.AND = [mesaFilter]
  }

  const [user, workspace, membership, propostas] = await Promise.all([
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
    db.proposta.findMany({
      where,
      include: {
        cliente: { select: { id: true, nome: true, whatsapp: true } },
        gerenteConta: {
          select: { id: true, email: true, user: { select: { nome: true } } },
        },
      },
      orderBy: { criadaEm: 'desc' },
      take: 100,
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
      <PropostasAutorizacaoBoard initial={propostas as any} />
    </BhGrainShell>
  )
}
