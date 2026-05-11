import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'

const schema = z.object({ texto: z.string().min(1).max(2000) })

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const cliente = await db.cliente.findFirst({ where: { id: params.id, ...scope.whereOwn() } })
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  const mensagens = await db.mensagemProdutor.findMany({
    where: { clienteId: cliente.id },
    orderBy: { createdAt: 'asc' },
    take: 200,
  })
  return NextResponse.json({ mensagens })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const cliente = await db.cliente.findFirst({ where: { id: params.id, ...scope.whereOwn() } })
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Texto inválido' }, { status: 400 })
  const msg = await db.mensagemProdutor.create({
    data: {
      workspaceId: cliente.workspaceId,
      clienteId: cliente.id,
      remetente: 'corretora',
      texto: parsed.data.texto,
    },
  })
  return NextResponse.json({ mensagem: msg })
}
