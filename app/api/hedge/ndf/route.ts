import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const ndfSchema = z.object({
  numero: z.string().min(1),
  tipo: z.enum(['moeda', 'commodity']),
  contraparteNome: z.string().min(1),
  contraparteCnpj: z.string().optional(),
  direcao: z.enum(['compra', 'venda']),
  ativoTipo: z.string().min(1),
  notional: z.number().positive(),
  strike: z.number().positive(),
  dataAbertura: z.string().datetime().optional(),
  dataVencimento: z.string(),
  observacoes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const status = searchParams.get('status') || ''
  const tipo = searchParams.get('tipo') || ''
  const where: any = scope.whereOwn()
  if (status) where.status = status
  if (tipo) where.tipo = tipo

  const data = await db.nDF.findMany({
    where,
    orderBy: { dataVencimento: 'asc' },
  })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope)
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const data = ndfSchema.parse(await request.json())
    const created = await db.nDF.create({
      data: {
        workspaceId: scope.workspaceId,
        numero: data.numero,
        tipo: data.tipo,
        contraparteNome: data.contraparteNome,
        contraparteCnpj: data.contraparteCnpj,
        direcao: data.direcao,
        ativoTipo: data.ativoTipo,
        notional: data.notional,
        strike: data.strike,
        dataAbertura: data.dataAbertura ? new Date(data.dataAbertura) : new Date(),
        dataVencimento: new Date(data.dataVencimento),
        observacoes: data.observacoes,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (error?.issues)
      return NextResponse.json(
        { error: 'Dados inválidos', issues: error.issues },
        { status: 400 }
      )
    if (error?.code === 'P2002')
      return NextResponse.json(
        { error: 'Número já existe no workspace' },
        { status: 409 }
      )
    console.error('Create NDF error:', error)
    return NextResponse.json({ error: 'Erro ao criar NDF' }, { status: 500 })
  }
}
