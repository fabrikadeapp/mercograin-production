import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePortal } from '@/lib/portal-produtor/scope'

export async function POST(
  _: Request,
  { params }: { params: { mensagemId: string } }
) {
  const scope = await requirePortal()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const msg = await db.mensagemProdutor.findFirst({
    where: { id: params.mensagemId, clienteId: scope.clienteId },
  })
  if (!msg) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  if (msg.remetente === 'produtor') {
    return NextResponse.json({ ok: true, skip: 'própria mensagem' })
  }
  await db.mensagemProdutor.update({
    where: { id: msg.id },
    data: { lidaEm: new Date() },
  })
  return NextResponse.json({ ok: true })
}
