/**
 * POST /api/fiscal/guias/[id]/marcar-pago
 * Body: { pagoEm?: ISODate }
 */
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const pagoEm = body?.pagoEm ? new Date(body.pagoEm) : new Date()
  if (isNaN(pagoEm.getTime())) {
    return NextResponse.json({ error: 'pagoEm inválido' }, { status: 400 })
  }

  const existing = await db.guia.findFirst({ where: { id: params.id, workspaceId: scope.workspaceId } })
  if (!existing) return NextResponse.json({ error: 'Guia não encontrada' }, { status: 404 })
  if (existing.status === 'cancelado') {
    return NextResponse.json({ error: 'Guia cancelada não pode ser marcada paga' }, { status: 409 })
  }

  const guia = await db.guia.update({
    where: { id: params.id },
    data: { status: 'pago', pagoEm },
  })

  await db.auditLog.create({
    data: {
      userId: scope.userId,
      acao: 'guia.pagar',
      entidade: 'Guia',
      entidadeId: guia.id,
      workspaceId: scope.workspaceId,
      mudancas: { pagoEm: pagoEm.toISOString() },
    },
  }).catch(() => {})

  return NextResponse.json({ data: guia })
}
