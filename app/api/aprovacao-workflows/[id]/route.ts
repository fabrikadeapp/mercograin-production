import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const scope = await getScope()
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const wf = await db.aprovacaoWorkflow.findFirst({
    where: { id, ...scope.whereOwn() },
  })
  if (!wf)
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(wf)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const scope = await getScope()
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!scope.isAdmin && !scope.isWorkspaceOwner && scope.workspaceRole !== 'admin')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const body = await request.json()
  const wf = await db.aprovacaoWorkflow.findFirst({
    where: { id, ...scope.whereOwn() },
  })
  if (!wf)
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const updated = await db.aprovacaoWorkflow.update({
    where: { id },
    data: {
      nome: body.nome ?? wf.nome,
      descricao: body.descricao ?? wf.descricao,
      condicao: body.condicao ?? wf.condicao,
      etapas: body.etapas ?? wf.etapas,
      slaHoras: body.slaHoras ?? wf.slaHoras,
      ativo: typeof body.ativo === 'boolean' ? body.ativo : wf.ativo,
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
  if (!scope.isAdmin && !scope.isWorkspaceOwner && scope.workspaceRole !== 'admin')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  const wf = await db.aprovacaoWorkflow.findFirst({
    where: { id, ...scope.whereOwn() },
  })
  if (!wf)
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  await db.aprovacaoWorkflow.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
