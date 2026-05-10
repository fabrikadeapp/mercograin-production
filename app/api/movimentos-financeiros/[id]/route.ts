import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const scope = await getScope()
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const m = await db.movimentoFinanceiro.findFirst({
    where: { id, ...scope.whereOwn() },
  })
  if (!m) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const body = await request.json()
  const updated = await db.movimentoFinanceiro.update({
    where: { id },
    data: {
      data: body.data ? new Date(body.data) : m.data,
      tipo: body.tipo ?? m.tipo,
      natureza: body.natureza ?? m.natureza,
      valor: body.valor ?? m.valor,
      descricao: body.descricao ?? m.descricao,
      centroCustoId: body.centroCustoId === undefined ? m.centroCustoId : body.centroCustoId,
      contratoId: body.contratoId === undefined ? m.contratoId : body.contratoId,
      safraId: body.safraId === undefined ? m.safraId : body.safraId,
      cultura: body.cultura === undefined ? m.cultura : body.cultura,
      conciliado:
        typeof body.conciliado === 'boolean' ? body.conciliado : m.conciliado,
      conciliadoEm: body.conciliado === true ? new Date() : m.conciliadoEm,
      observacoes: body.observacoes === undefined ? m.observacoes : body.observacoes,
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const scope = await getScope()
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const m = await db.movimentoFinanceiro.findFirst({
    where: { id, ...scope.whereOwn() },
  })
  if (!m) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  await db.movimentoFinanceiro.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
