import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const safraSchema = z.object({
  nome: z.string().min(2),
  cultura: z.enum(['soja', 'milho', 'trigo']),
  inicio: z.coerce.date(),
  fim: z.coerce.date(),
  ativa: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const cultura = searchParams.get('cultura') || undefined
    const ativaParam = searchParams.get('ativa')
    const filters: any = {}
    if (cultura) filters.cultura = cultura
    if (ativaParam !== null && ativaParam !== '') filters.ativa = ativaParam === 'true'

    const data = await db.safra.findMany({
      where: scope.whereOwn(filters),
      orderBy: { inicio: 'desc' },
    })
    return NextResponse.json({ data })
  } catch (e) {
    console.error('GET safras error', e)
    return NextResponse.json({ error: 'Erro ao buscar safras' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const body = await request.json()
    const data = safraSchema.parse(body)
    if (data.fim < data.inicio) {
      return NextResponse.json({ error: 'Data fim < início' }, { status: 400 })
    }
    const created = await db.safra.create({
      data: { ...data, ativa: data.ativa ?? true, workspaceId: scope.workspaceId },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
    }
    if (e?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Já existe safra com mesmo nome+cultura' },
        { status: 409 }
      )
    }
    console.error('POST safras error', e)
    return NextResponse.json({ error: 'Erro ao criar safra' }, { status: 500 })
  }
}
