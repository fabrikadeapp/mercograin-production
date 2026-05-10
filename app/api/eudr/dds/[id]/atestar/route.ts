/**
 * S5 M9 — POST /api/eudr/dds/[id]/atestar
 *
 * Atestação formal por owner/admin. Trava o documento em conclusao='aprovada'.
 */
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit/log'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  if (!['owner', 'admin'].includes(scope.workspaceRole) && !scope.isAdmin) {
    return NextResponse.json({ error: 'Apenas owner/admin podem atestar DDS' }, { status: 403 })
  }

  const dds = await db.dueDiligenceStatement.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!dds) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  if (dds.atestadoEm) {
    return NextResponse.json({ error: 'DDS já atestada' }, { status: 409 })
  }

  if (dds.riscoNivel === 'critico') {
    return NextResponse.json(
      {
        error: 'DDS com risco crítico não pode ser atestada — mitigue os fatores antes',
        riscoNivel: dds.riscoNivel,
      },
      { status: 409 },
    )
  }

  const updated = await db.dueDiligenceStatement.update({
    where: { id: dds.id },
    data: {
      atestadoPor: scope.userId,
      atestadoEm: new Date(),
      conclusao: 'aprovada',
    },
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'update',
    entidade: 'dds',
    entidadeId: dds.id,
    mudancas: { conclusao: 'aprovada', atestadoPor: scope.userId, riscoNivel: dds.riscoNivel },
  })

  return NextResponse.json(updated)
}
