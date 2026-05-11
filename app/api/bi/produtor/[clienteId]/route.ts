/**
 * GET /api/bi/produtor/[clienteId]
 * Painel produtor (B2C lite). Valida que o cliente pertence ao workspace ativo.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { kpisProdutor } from '@/lib/bi/produtor'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { clienteId: string } }
) {
  try {
    const { searchParams } = new URL(req.url)
    const scope = await getScope(searchParams)
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const cliente = await db.cliente.findFirst({
      where: { id: params.clienteId, workspaceId: scope.workspaceId },
      select: { id: true },
    })
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    const data = await kpisProdutor(params.clienteId)
    return NextResponse.json(data)
  } catch (e: any) {
    console.error('GET /api/bi/produtor/[clienteId] error:', e)
    return NextResponse.json({ error: 'Erro ao gerar KPIs do produtor' }, { status: 500 })
  }
}
