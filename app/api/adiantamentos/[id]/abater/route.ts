import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const abaterSchema = z.object({
  qtdSc: z.number().positive(),
  ticketBalancaId: z.string().optional(),
  observacoes: z.string().optional(),
})

/**
 * Registra entrega física que abate o saldo de um adiantamento.
 * Atualiza qtdAbatidaSc e status (parcial/quitado).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope)
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const data = abaterSchema.parse(await request.json())

    const adv = await db.adiantamento.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!adv)
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    if (adv.status === 'quitado')
      return NextResponse.json(
        { error: 'Adiantamento já quitado' },
        { status: 400 }
      )

    const novaAbatida = adv.qtdAbatidaSc + data.qtdSc
    if (novaAbatida > adv.qtdEsperadaSc + 1e-6) {
      return NextResponse.json(
        {
          error: `qtdSc (${data.qtdSc}) excede saldo (${(
            adv.qtdEsperadaSc - adv.qtdAbatidaSc
          ).toFixed(2)})`,
        },
        { status: 400 }
      )
    }

    const novoStatus =
      Math.abs(novaAbatida - adv.qtdEsperadaSc) <= 1e-6
        ? 'quitado'
        : 'parcial'

    const updated = await db.adiantamento.update({
      where: { id: adv.id },
      data: {
        qtdAbatidaSc: novaAbatida,
        status: novoStatus,
        observacoes: data.observacoes
          ? `${adv.observacoes || ''}\n[abate ${new Date().toISOString()}] ${data.observacoes}`.trim()
          : adv.observacoes,
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Abater adiantamento error:', error)
    return NextResponse.json({ error: 'Erro ao abater' }, { status: 500 })
  }
}
