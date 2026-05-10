import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  codigo: z.string().min(1),
  nome: z.string().min(1),
  descricao: z.string().optional(),
  paiId: z.string().optional().nullable(),
  ativo: z.boolean().default(true),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const data = await db.centroCusto.findMany({
    where: scope.whereOwn(),
    orderBy: [{ codigo: 'asc' }],
  })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const scope = await getScope()
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const data = schema.parse(body)

    if (data.paiId) {
      const pai = await db.centroCusto.findFirst({
        where: { id: data.paiId, ...scope.whereOwn() },
      })
      if (!pai)
        return NextResponse.json({ error: 'Pai inválido' }, { status: 400 })
    }

    const cc = await db.centroCusto.create({
      data: {
        workspaceId: scope.workspaceId,
        codigo: data.codigo,
        nome: data.nome,
        descricao: data.descricao,
        paiId: data.paiId || null,
        ativo: data.ativo,
      },
    })
    return NextResponse.json(cc, { status: 201 })
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
    if (e?.code === 'P2002')
      return NextResponse.json({ error: 'Código já existe' }, { status: 409 })
    console.error('Create centro custo error:', e)
    return NextResponse.json({ error: 'Erro ao criar' }, { status: 500 })
  }
}
