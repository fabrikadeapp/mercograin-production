import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePortal } from '@/lib/portal-produtor/scope'

const schema = z.object({ texto: z.string().min(1).max(2000) })

export async function GET() {
  const scope = await requirePortal()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const mensagens = await db.mensagemProdutor.findMany({
    where: { clienteId: scope.clienteId, workspaceId: scope.workspaceId },
    orderBy: { createdAt: 'asc' },
    take: 200,
  })
  return NextResponse.json({ mensagens })
}

export async function POST(req: NextRequest) {
  const scope = await requirePortal()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Texto inválido' }, { status: 400 })
  }
  const msg = await db.mensagemProdutor.create({
    data: {
      workspaceId: scope.workspaceId,
      clienteId: scope.clienteId,
      remetente: 'produtor',
      texto: parsed.data.texto,
    },
  })
  return NextResponse.json({ mensagem: msg })
}
