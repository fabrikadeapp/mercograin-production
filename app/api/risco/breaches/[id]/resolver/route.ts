import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logAudit } from '@/lib/audit/log'

const schema = z.object({ observacao: z.string().optional() })

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  let body: any = {}
  try {
    body = schema.parse(await req.json())
  } catch {
    body = {}
  }
  const found = await db.limiteBreach.findFirst({ where: { id: params.id, ...scope.whereOwn() } })
  if (!found) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  if (found.resolvidoEm)
    return NextResponse.json({ error: 'Breach já resolvido' }, { status: 400 })
  const updated = await db.limiteBreach.update({
    where: { id: params.id },
    data: { resolvidoEm: new Date(), observacao: body.observacao ?? found.observacao },
  })
  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'update',
    entidade: 'limite_breach',
    entidadeId: params.id,
    mudancas: { resolvidoEm: updated.resolvidoEm, observacao: updated.observacao },
  })
  return NextResponse.json(updated)
}
