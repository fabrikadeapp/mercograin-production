import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePortal } from '@/lib/portal-produtor/scope'

export async function GET() {
  const scope = await requirePortal()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const cliente = await db.cliente.findUnique({
    where: { id: scope.clienteId },
    select: { id: true, nome: true, email: true, cnpj: true, cpf: true, workspaceId: true },
  })
  const ws = await db.workspace.findUnique({
    where: { id: scope.workspaceId },
    select: { name: true, slug: true },
  })
  return NextResponse.json({ cliente, workspace: ws })
}
