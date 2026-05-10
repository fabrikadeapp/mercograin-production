import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { nextNumero } from '@/lib/operacao-fisica/numbering'

const loteSchema = z.object({
  numero: z.string().optional(),
  cultura: z.enum(['soja', 'milho', 'trigo']),
  safraId: z.string().optional().nullable(),
  armazemId: z.string(),
  qtdInicialSc: z.coerce.number().nonnegative(),
  umidadeMedia: z.coerce.number().optional().nullable(),
  impurezaMedia: z.coerce.number().optional().nullable(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'))
  const cultura = searchParams.get('cultura') || undefined
  const status = searchParams.get('status') || undefined
  const armazemId = searchParams.get('armazemId') || undefined
  const safraId = searchParams.get('safraId') || undefined

  const filters: any = {}
  if (cultura) filters.cultura = cultura
  if (status) filters.status = status
  if (armazemId) filters.armazemId = armazemId
  if (safraId) filters.safraId = safraId

  const where = scope.whereOwn(filters)
  const [total, data] = await Promise.all([
    db.loteEstoque.count({ where }),
    db.loteEstoque.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        armazem: { select: { id: true, nome: true } },
        safra: { select: { id: true, nome: true } },
      },
    }),
  ])
  return NextResponse.json({ data, total, page, limit, pages: Math.ceil(total / limit) })
}

export async function POST(request: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = await request.json()
    const data = loteSchema.parse(body)
    const armazem = await db.armazem.findFirst({
      where: { id: data.armazemId, ...scope.whereOwn() },
    })
    if (!armazem) return NextResponse.json({ error: 'Armazém inválido' }, { status: 400 })

    const numero = data.numero || (await nextNumero('lote', scope.workspaceId))

    const created = await db.loteEstoque.create({
      data: {
        numero,
        cultura: data.cultura,
        safraId: data.safraId || null,
        armazemId: data.armazemId,
        qtdInicialSc: data.qtdInicialSc,
        qtdAtualSc: data.qtdInicialSc,
        umidadeMedia: data.umidadeMedia ?? null,
        impurezaMedia: data.impurezaMedia ?? null,
        workspaceId: scope.workspaceId,
      },
    })
    // log abertura como movimentação 'entrada'
    if (data.qtdInicialSc > 0) {
      await db.movimentacaoLote.create({
        data: {
          workspaceId: scope.workspaceId,
          loteId: created.id,
          tipo: 'entrada',
          qtdSc: data.qtdInicialSc,
          motivo: 'Abertura do lote',
        },
      })
    }
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
    if (e?.code === 'P2002')
      return NextResponse.json({ error: 'Número de lote duplicado' }, { status: 409 })
    console.error('POST lote error', e)
    return NextResponse.json({ error: 'Erro ao criar lote' }, { status: 500 })
  }
}
