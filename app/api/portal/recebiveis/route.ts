import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePortal } from '@/lib/portal-produtor/scope'

export async function GET() {
  const scope = await requirePortal()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const boletos = await db.boleto.findMany({
    where: { clienteId: scope.clienteId, workspaceId: scope.workspaceId },
    orderBy: { vencimento: 'desc' },
    select: {
      id: true,
      valor: true,
      vencimento: true,
      status: true,
      confirmadoEm: true,
    },
  })
  return NextResponse.json({ boletos })
}
