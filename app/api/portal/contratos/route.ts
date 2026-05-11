import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePortal } from '@/lib/portal-produtor/scope'

export async function GET() {
  const scope = await requirePortal()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const contratos = await db.contrato.findMany({
    where: { clienteId: scope.clienteId, workspaceId: scope.workspaceId },
    select: {
      id: true,
      numero: true,
      criadoEm: true,
      dataFim: true,
      assinadoEm: true,
      statusAssinatura: true,
      pdfUrl: true,
      proposta: { select: { valorTotal: true, graos: true, tipo: true } },
    },
    orderBy: { criadoEm: 'desc' },
  })
  return NextResponse.json({ contratos })
}
