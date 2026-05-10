import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const tabelaSchema = z.object({
  cultura: z.enum(['soja', 'milho', 'trigo']),
  nome: z.string().min(2),
  umidadePadrao: z.coerce.number().nonnegative(),
  umidadeMaxima: z.coerce.number().nonnegative(),
  impurezaPadrao: z.coerce.number().nonnegative(),
  impurezaMaxima: z.coerce.number().nonnegative(),
  ardidosMaximo: z.coerce.number().nonnegative(),
  quebradosMaximo: z.coerce.number().nonnegative(),
  esverdeadosMaximo: z.coerce.number().nonnegative().optional().nullable(),
  pesoHectolitroMin: z.coerce.number().nonnegative().optional().nullable(),
  fatorDescontoUmidade: z.coerce.number().nonnegative().optional(),
  fatorDescontoImpureza: z.coerce.number().nonnegative().optional(),
  fatorDescontoArdidos: z.coerce.number().nonnegative().optional(),
  fatorDescontoQuebrados: z.coerce.number().nonnegative().optional(),
  ativo: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const cultura = searchParams.get('cultura') || undefined
  const filters: any = {}
  if (cultura) filters.cultura = cultura
  const data = await db.tabelaClassificacao.findMany({
    where: scope.whereOwn(filters),
    orderBy: { nome: 'asc' },
  })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = await request.json()
    const data = tabelaSchema.parse(body)
    const created = await db.tabelaClassificacao.create({
      data: { ...data, workspaceId: scope.workspaceId },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
    if (e?.code === 'P2002')
      return NextResponse.json({ error: 'Tabela já existe' }, { status: 409 })
    console.error('POST tabela', e)
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}
