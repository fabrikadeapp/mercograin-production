import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { CBOT_CONTRATO, contratosParaSacas, type CulturaCbot } from '@/lib/hedge/conversao'

const posicaoSchema = z.object({
  numero: z.string().min(1),
  tipo: z.enum(['long', 'short']),
  cultura: z.enum(['soja', 'milho', 'trigo']).nullable().optional(),
  contratoFuturo: z.string().min(1),
  vencimento: z.string(),
  qtdContratos: z.number().positive(),
  precoEntradaUsdBu: z.number().positive().optional(),
  precoEntradaBrlSc: z.number().positive().optional(),
  cambioEntradaUsdBrl: z.number().positive().optional(),
  margemDepositadaUSD: z.number().nonnegative().optional(),
  margemDepositadaBRL: z.number().nonnegative().optional(),
  corretagemUSD: z.number().nonnegative().optional(),
  contratoOrigemId: z.string().optional().nullable(),
  observacoes: z.string().optional(),
})

const CULTURA_TO_CBOT: Record<string, CulturaCbot> = {
  soja: 'ZS',
  milho: 'ZC',
  trigo: 'ZW',
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope)
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const status = searchParams.get('status') || ''
    const tipo = searchParams.get('tipo') || ''
    const cultura = searchParams.get('cultura') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '25'))
    const skip = (page - 1) * limit

    const where: any = scope.whereOwn()
    if (status) where.status = status
    if (tipo) where.tipo = tipo
    if (cultura) where.cultura = cultura

    const [total, data] = await Promise.all([
      db.posicaoHedge.count({ where }),
      db.posicaoHedge.findMany({
        where,
        include: {
          contratoOrigem: { select: { id: true, numero: true } },
          _count: { select: { marcacoes: true } },
        },
        orderBy: { abertoEm: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return NextResponse.json({
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Get posicoes hedge error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar posições de hedge' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope)
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const data = posicaoSchema.parse(await request.json())

    // Calcular qtdEquivalenteSc se cultura for CBOT-suportada
    let qtdEquivalenteSc = 0
    if (data.cultura) {
      const sym = CULTURA_TO_CBOT[data.cultura]
      if (sym && CBOT_CONTRATO[sym]) {
        qtdEquivalenteSc = contratosParaSacas(data.qtdContratos, sym)
      }
    }

    if (data.contratoOrigemId) {
      const ct = await db.contrato.findFirst({
        where: { id: data.contratoOrigemId, ...scope.whereOwn() },
      })
      if (!ct)
        return NextResponse.json(
          { error: 'Contrato origem não encontrado no workspace' },
          { status: 400 }
        )
    }

    const created = await db.posicaoHedge.create({
      data: {
        workspaceId: scope.workspaceId,
        numero: data.numero,
        tipo: data.tipo,
        cultura: data.cultura ?? null,
        contratoFuturo: data.contratoFuturo,
        vencimento: new Date(data.vencimento),
        qtdContratos: data.qtdContratos,
        qtdEquivalenteSc,
        precoEntradaUsdBu: data.precoEntradaUsdBu ?? null,
        precoEntradaBrlSc: data.precoEntradaBrlSc ?? null,
        cambioEntradaUsdBrl: data.cambioEntradaUsdBrl ?? null,
        margemDepositadaUSD: data.margemDepositadaUSD ?? null,
        margemDepositadaBRL: data.margemDepositadaBRL ?? null,
        corretagemUSD: data.corretagemUSD ?? 0,
        contratoOrigemId: data.contratoOrigemId ?? null,
        observacoes: data.observacoes,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (error?.issues) {
      return NextResponse.json(
        { error: 'Dados inválidos', issues: error.issues },
        { status: 400 }
      )
    }
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Número de posição já existe no workspace' },
        { status: 409 }
      )
    }
    console.error('Create posicao hedge error:', error)
    return NextResponse.json(
      { error: 'Erro ao criar posição' },
      { status: 500 }
    )
  }
}
