import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const triangularSchema = z.object({
  numero: z.string().min(1),
  clienteIdFilho: z.string().min(1),
  // Se omitido, usa propIdFk do pai
  proposIdFk: z.string().optional(),
  dataInicio: z.string().datetime().optional(),
  dataFim: z.string().datetime().optional(),
})

/**
 * Cria contrato filho ligado ao contrato pai (operação triangular).
 * Mesma proposta de origem por default; cliente pode ser diferente.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope)
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const data = triangularSchema.parse(await request.json())

    const pai = await db.contrato.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!pai)
      return NextResponse.json(
        { error: 'Contrato pai não encontrado' },
        { status: 404 }
      )

    const cliente = await db.cliente.findFirst({
      where: { id: data.clienteIdFilho, ...scope.whereOwn() },
    })
    if (!cliente)
      return NextResponse.json(
        { error: 'Cliente filho não encontrado' },
        { status: 404 }
      )

    const proposIdFk = data.proposIdFk || pai.proposIdFk
    const proposta = await db.proposta.findFirst({
      where: { id: proposIdFk, ...scope.whereOwn() },
    })
    if (!proposta)
      return NextResponse.json(
        { error: 'Proposta não encontrada' },
        { status: 404 }
      )

    const filho = await db.contrato.create({
      data: {
        workspaceId: scope.workspaceId,
        numero: data.numero,
        proposIdFk,
        clienteId: data.clienteIdFilho,
        dataInicio: data.dataInicio ? new Date(data.dataInicio) : new Date(),
        dataFim: data.dataFim ? new Date(data.dataFim) : null,
        statusAssinatura: 'pendente',
        modalidade: 'triangular',
        contratoOriginalId: pai.id,
      },
    })

    // Atualiza pai como triangular se ainda não for
    if (pai.modalidade !== 'triangular') {
      await db.contrato.update({
        where: { id: pai.id },
        data: { modalidade: 'triangular' },
      })
    }

    return NextResponse.json(filho, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Triangular error:', error)
    return NextResponse.json(
      { error: error?.message || 'Erro ao criar contrato triangular' },
      { status: 500 }
    )
  }
}
