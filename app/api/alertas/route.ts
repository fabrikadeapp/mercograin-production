/**
 * GET /api/alertas — list user's price alerts.
 * POST /api/alertas — create new alert.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  symbol: z.string().min(1),
  graoLabel: z.string().min(1),
  operador: z.enum(['>', '<']),
  preco: z.number().positive(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  // AlertaPreco já tem userId (escopo direto)
  const where: any = scope.isAdmin && searchParams.get('scope') === 'all' ? {} : { userId: scope.userId }
  const data = await db.alertaPreco.findMany({
    where,
    orderBy: { criadoEm: 'desc' },
  })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const body = await req.json()
    const data = schema.parse(body)
    const created = await db.alertaPreco.create({
      data: { ...data, userId: scope.userId },
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
