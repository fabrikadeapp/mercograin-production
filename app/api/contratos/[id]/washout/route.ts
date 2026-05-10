import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { calcularImpactoWashout } from '@/lib/originacao/washout'

const washoutSchema = z.object({
  motivo: z.enum([
    'cliente_desistiu',
    'forcas_maior',
    'preco_inviavel',
    'outro',
  ]),
  motivoDescricao: z.string().optional(),
  custoWashout: z.number().min(0).default(0),
  custoQuemPaga: z.enum(['comprador', 'vendedor', 'corretora']).optional(),
  qtdAfetadaSc: z.number().positive(),
  /** Se true, executa: cancela contrato + fixacao + retorna saldo. */
  executar: z.boolean().default(false),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope)
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    if (
      scope.workspaceRole !== 'owner' &&
      scope.workspaceRole !== 'admin' &&
      !scope.isAdmin
    ) {
      return NextResponse.json(
        { error: 'Apenas admin/owner pode aprovar washout' },
        { status: 403 }
      )
    }

    const data = washoutSchema.parse(await request.json())

    const contrato = await db.contrato.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: {
        fixacao: { include: { fixacoes: true } },
        adiantamentos: true,
        proposta: { select: { graos: true } },
      },
    })
    if (!contrato)
      return NextResponse.json(
        { error: 'Contrato não encontrado' },
        { status: 404 }
      )

    // Estima qtd contratada (somando volumeSc dos grãos da proposta)
    let qtdContratadaSc = data.qtdAfetadaSc
    const graos = (contrato.proposta?.graos as any) || []
    if (Array.isArray(graos)) {
      const total = graos.reduce(
        (acc: number, g: any) =>
          acc + Number(g.volumeSc ?? g.quantidadeSc ?? g.qtd ?? 0),
        0
      )
      if (total > 0) qtdContratadaSc = total
    }

    const impacto = calcularImpactoWashout({
      contratoId: contrato.id,
      qtdContratadaSc,
      qtdJaFixadaSc: contrato.fixacao?.qtdFixadaSc || 0,
      custoWashout: data.custoWashout,
      fixacoesAbertas: contrato.fixacao?.fixacoes.map((f) => ({
        id: f.id,
        qtdSc: f.qtdSc,
        precoSc: f.precoSc,
      })),
      adiantamentosAbertos: contrato.adiantamentos.map((a) => ({
        id: a.id,
        valor: Number(a.valor),
        qtdEsperadaSc: a.qtdEsperadaSc,
        qtdAbatidaSc: a.qtdAbatidaSc,
        status: a.status,
      })),
    })

    if (!data.executar) {
      return NextResponse.json({ impacto })
    }

    // Executa: cria washout + cancela contrato/fixacao
    const result = await db.$transaction(async (tx) => {
      const w = await tx.washout.create({
        data: {
          workspaceId: scope.workspaceId,
          contratoId: contrato.id,
          motivo: data.motivo,
          motivoDescricao: data.motivoDescricao,
          custoWashout: data.custoWashout,
          custoQuemPaga: data.custoQuemPaga,
          qtdAfetadaSc: data.qtdAfetadaSc,
          aprovadoPor: scope.userId,
        },
      })

      await tx.contrato.update({
        where: { id: contrato.id },
        data: { statusAssinatura: 'cancelado' },
      })

      if (contrato.fixacao) {
        await tx.contratoFixacao.update({
          where: { id: contrato.fixacao.id },
          data: { statusFixacao: 'cancelado' },
        })
      }

      return { washout: w, impacto }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Washout error:', error)
    return NextResponse.json(
      { error: error?.message || 'Erro ao processar washout' },
      { status: 500 }
    )
  }
}
