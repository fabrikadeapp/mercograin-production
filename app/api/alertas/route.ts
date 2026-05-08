/**
 * GET /api/alertas — list user's price alerts.
 * POST /api/alertas — create new alert.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  symbol: z.string().min(1),
  graoLabel: z.string().min(1),
  operador: z.enum(['>', '<']),
  preco: z.number().positive(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const data = await db.alertaPreco.findMany({
    where: { userId: session.user.id },
    orderBy: { criadoEm: 'desc' },
  })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const body = await req.json()
    const data = schema.parse(body)
    const created = await db.alertaPreco.create({
      data: { ...data, userId: session.user.id },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0]?.message }, { status: 400 })
    }
    console.error('POST /alertas error:', e)
    return NextResponse.json({ error: 'Erro ao criar alerta' }, { status: 500 })
  }
}
