import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  precoLiquidacao: z.number().positive(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const data = schema.parse(await request.json())
  const ndf = await db.nDF.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!ndf) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  if (ndf.status !== 'aberta')
    return NextResponse.json({ error: 'NDF não está aberta' }, { status: 400 })

  // Resultado: NDF de venda (USD futuro a strike) → ganha quando strike > precoLiquidacao
  // NDF de compra → ganha quando precoLiquidacao > strike
  const sinal = ndf.direcao === 'venda' ? 1 : -1
  const diff = Number(ndf.strike) - data.precoLiquidacao
  const resultadoBRL = sinal * diff * Number(ndf.notional)

  const updated = await db.nDF.update({
    where: { id: ndf.id },
    data: {
      status: 'liquidada',
      precoLiquidacao: data.precoLiquidacao,
      resultadoBRL,
    },
  })
  return NextResponse.json(updated)
}
