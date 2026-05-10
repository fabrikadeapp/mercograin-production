import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { aplicarFixacao } from '@/lib/originacao/fixacao'

const fixacaoSchema = z.object({
  qtdSc: z.number().positive(),
  precoSc: z.number().positive(),
  precoUSDSc: z.number().positive().optional(),
  cotacaoUSDBRL: z.number().positive().optional(),
  premio: z.number().optional(),
  base: z.number().optional(),
  observacoes: z.string().optional(),
  // Setup inicial do ContratoFixacao se ainda não existir:
  setupQtdTotalSc: z.number().positive().optional(),
  setupModalidade: z
    .enum(['fixo', 'a_fixar', 'misto', 'barter', 'triangular'])
    .optional(),
  setupFixacaoFim: z.string().datetime().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope)
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const contrato = await db.contrato.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      select: { id: true },
    })
    if (!contrato)
      return NextResponse.json(
        { error: 'Contrato não encontrado' },
        { status: 404 }
      )

    const fixacao = await db.contratoFixacao.findUnique({
      where: { contratoId: params.id },
      include: {
        fixacoes: { orderBy: { fixadoEm: 'desc' } },
      },
    })

    return NextResponse.json({ data: fixacao })
  } catch (error) {
    console.error('Get fixacoes error:', error)
    return NextResponse.json({ error: 'Erro ao buscar fixações' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope)
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const data = fixacaoSchema.parse(await request.json())

    const contrato = await db.contrato.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: { fixacao: true },
    })
    if (!contrato)
      return NextResponse.json(
        { error: 'Contrato não encontrado' },
        { status: 404 }
      )

    const result = await db.$transaction(async (tx) => {
      // Garante existência do ContratoFixacao
      let cf = contrato.fixacao
      if (!cf) {
        if (!data.setupQtdTotalSc) {
          throw new Error(
            'Contrato sem ContratoFixacao — setupQtdTotalSc obrigatório na primeira fixação'
          )
        }
        cf = await tx.contratoFixacao.create({
          data: {
            workspaceId: scope.workspaceId,
            contratoId: contrato.id,
            modalidade: data.setupModalidade || 'a_fixar',
            qtdTotalSc: data.setupQtdTotalSc,
            qtdRemanescenteSc: data.setupQtdTotalSc,
            fixacaoFim: data.setupFixacaoFim
              ? new Date(data.setupFixacaoFim)
              : null,
            statusFixacao: 'pendente',
          },
        })
        // Atualiza modalidade do contrato se ainda 'fixo'
        if (contrato.modalidade === 'fixo') {
          await tx.contrato.update({
            where: { id: contrato.id },
            data: { modalidade: cf.modalidade },
          })
        }
      }

      const calc = aplicarFixacao({
        contratoFixacao: {
          qtdTotalSc: cf.qtdTotalSc,
          qtdFixadaSc: cf.qtdFixadaSc,
          fixacaoFim: cf.fixacaoFim,
        },
        qtdSc: data.qtdSc,
        precoSc: data.precoSc,
        cotacaoUSDBRL: data.cotacaoUSDBRL,
        premio: data.premio,
        base: data.base,
      })

      if (!calc.ok) {
        throw new Error(calc.erros.join('; '))
      }

      const fixacao = await tx.fixacao.create({
        data: {
          workspaceId: scope.workspaceId,
          contratoFixacaoId: cf.id,
          qtdSc: data.qtdSc,
          precoSc: data.precoSc,
          precoUSDSc: data.precoUSDSc,
          cotacaoUSDBRL: data.cotacaoUSDBRL,
          premio: data.premio,
          base: data.base,
          observacoes: data.observacoes,
          fixadoPor: scope.userId,
        },
      })

      const cfUpdated = await tx.contratoFixacao.update({
        where: { id: cf.id },
        data: {
          qtdFixadaSc: calc.novaQtdFixada,
          qtdRemanescenteSc: calc.novaQtdRemanescente,
          statusFixacao: calc.novoStatus,
        },
      })

      return { fixacao, contratoFixacao: cfUpdated, alertas: calc.alertas }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    const msg = error?.message || 'Erro ao criar fixação'
    const status = /excede|obrigatório|inválida|inválido|deve ser/.test(msg)
      ? 400
      : 500
    if (status === 500) console.error('Create fixacao error:', error)
    return NextResponse.json({ error: msg }, { status })
  }
}
