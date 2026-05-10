import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  produtorId: z.string().min(1),
  nome: z.string().min(1),
  area: z.number().positive(),
  cultura: z.string().optional().nullable(),
  safraId: z.string().optional().nullable(),
  produtividadeEstimadaSc: z.number().optional().nullable(),
  produtividadeRealSc: z.number().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  municipio: z.string().optional().nullable(),
  uf: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const where: any = scope.whereOwn()
  const produtorId = searchParams.get('produtorId')
  if (produtorId) where.produtorId = produtorId

  const data = await db.talhao.findMany({
    where,
    include: {
      produtor: { select: { id: true, nome: true } },
      safra: { select: { id: true, nome: true, cultura: true } },
    },
    orderBy: { nome: 'asc' },
  })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const scope = await getScope()
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = await request.json()
    const d = schema.parse(body)

    const produtor = await db.cliente.findFirst({
      where: { id: d.produtorId, ...scope.whereOwn() },
    })
    if (!produtor)
      return NextResponse.json(
        { error: 'Produtor não encontrado' },
        { status: 404 }
      )

    const t = await db.talhao.create({
      data: {
        workspaceId: scope.workspaceId,
        produtorId: d.produtorId,
        nome: d.nome,
        area: d.area,
        cultura: d.cultura || null,
        safraId: d.safraId || null,
        produtividadeEstimadaSc: d.produtividadeEstimadaSc ?? null,
        produtividadeRealSc: d.produtividadeRealSc ?? null,
        latitude: d.latitude ?? null,
        longitude: d.longitude ?? null,
        municipio: d.municipio || null,
        uf: d.uf || null,
        observacoes: d.observacoes || null,
      },
    })
    return NextResponse.json(t, { status: 201 })
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
    if (e?.code === 'P2002')
      return NextResponse.json(
        { error: 'Já existe talhão com esse nome para o produtor' },
        { status: 409 }
      )
    console.error('Talhão create error:', e)
    return NextResponse.json({ error: 'Erro ao criar' }, { status: 500 })
  }
}
