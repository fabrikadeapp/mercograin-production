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
  const cc = await db.centroCusto.findFirst({
    where: { id, ...scope.whereOwn() },
  })
  if (!cc)
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const body = await request.json()
  const updated = await db.centroCusto.update({
    where: { id },
    data: {
      codigo: body.codigo ?? cc.codigo,
      nome: body.nome ?? cc.nome,
      descricao: body.descricao ?? cc.descricao,
      paiId: body.paiId === undefined ? cc.paiId : body.paiId,
      ativo: typeof body.ativo === 'boolean' ? body.ativo : cc.ativo,
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
  const cc = await db.centroCusto.findFirst({
    where: { id, ...scope.whereOwn() },
  })
  if (!cc)
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  await db.centroCusto.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
