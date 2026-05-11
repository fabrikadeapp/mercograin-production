import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePortal } from '@/lib/portal-produtor/scope'

export async function GET() {
  const scope = await requirePortal()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // ContratoFixacao via contratos do cliente
  const contratos = await db.contrato.findMany({
    where: { clienteId: scope.clienteId, workspaceId: scope.workspaceId },
    select: { id: true, numero: true },
  })
  const contratoIds = contratos.map((c) => c.id)
  const contratoFixacoes = contratoIds.length
    ? await (db as any).contratoFixacao.findMany({
        where: { contratoId: { in: contratoIds } },
      }).catch(() => [])
    : []
  const fixacoes = await (db as any).fixacao
    .findMany({
      where: { workspaceId: scope.workspaceId, clienteId: scope.clienteId },
      orderBy: { createdAt: 'desc' },
    })
    .catch(() => [])

  return NextResponse.json({ contratoFixacoes, fixacoes, contratos })
}
