import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { calcularBarter } from '@/lib/originacao/barter'

const barterSchema = z.object({
  contratoId: z.string().min(1),
  adiantamentoId: z.string().optional(),
  fornecedorId: z.string().optional(),
  descricao: z.string().min(1),
  quantidade: z.number().positive(),
  unidade: z.enum(['kg', 'l', 'sc', 'un']),
  precoUnit: z.number().positive(),
  precoFixadoSc: z.number().positive(),
  status: z
    .enum(['pendente', 'entregue', 'recebido_grao', 'cancelado'])
    .optional(),
  dataEntregaInsumo: z.string().datetime().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope)
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const status = searchParams.get('status') || ''
    const contratoId = searchParams.get('contratoId') || ''
    const where: any = scope.whereOwn()
    if (status) where.status = status
    if (contratoId) where.contratoId = contratoId

    const data = await db.barterInsumo.findMany({
      where,
      include: {
        fornecedor: { select: { id: true, razaoSocial: true } },
        contrato: { select: { id: true, numero: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Get barter error:', error)
    return NextResponse.json({ error: 'Erro ao buscar barter' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope)
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const data = barterSchema.parse(await request.json())

    const contrato = await db.contrato.findFirst({
      where: { id: data.contratoId, ...scope.whereOwn() },
    })
    if (!contrato)
      return NextResponse.json(
        { error: 'Contrato não encontrado' },
        { status: 404 }
      )

    if (data.fornecedorId) {
      const f = await db.fornecedor.findFirst({
        where: { id: data.fornecedorId, ...scope.whereOwn() },
      })
      if (!f)
        return NextResponse.json(
          { error: 'Fornecedor não encontrado' },
          { status: 404 }
        )
    }

    if (data.adiantamentoId) {
      const a = await db.adiantamento.findFirst({
        where: { id: data.adiantamentoId, ...scope.whereOwn() },
      })
      if (!a)
        return NextResponse.json(
          { error: 'Adiantamento não encontrado' },
          { status: 404 }
        )
    }

    const calc = calcularBarter(
      { quantidade: data.quantidade, precoUnit: data.precoUnit },
      data.precoFixadoSc
    )
    if (calc.qtdGraoEquivalenteSc <= 0) {
      return NextResponse.json(
        { error: 'Equivalência em grão inválida (verifique preços)' },
        { status: 400 }
      )
    }

    const created = await db.barterInsumo.create({
      data: {
        workspaceId: scope.workspaceId,
        contratoId: data.contratoId,
        adiantamentoId: data.adiantamentoId,
        fornecedorId: data.fornecedorId,
        descricao: data.descricao,
        quantidade: data.quantidade,
        unidade: data.unidade,
        precoUnit: data.precoUnit,
        valorTotal: calc.valorTotal,
        precoFixadoSc: data.precoFixadoSc,
        qtdGraoEquivalenteSc: calc.qtdGraoEquivalenteSc,
        status: data.status || 'pendente',
        dataEntregaInsumo: data.dataEntregaInsumo
          ? new Date(data.dataEntregaInsumo)
          : null,
      },
    })

    // Atualiza contrato pra modalidade barter se ainda não for
    if (
      contrato.modalidade !== 'barter' &&
      contrato.modalidade !== 'misto' &&
      contrato.modalidade !== 'triangular'
    ) {
      await db.contrato.update({
        where: { id: contrato.id },
        data: { modalidade: 'barter' },
      })
    }

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Create barter error:', error)
    return NextResponse.json({ error: 'Erro ao criar barter' }, { status: 500 })
  }
}
