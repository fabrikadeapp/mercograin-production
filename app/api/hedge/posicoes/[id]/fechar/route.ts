import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { calcularPnLFinal } from '@/lib/hedge/pnl'
import type { CulturaCbot } from '@/lib/hedge/conversao'

const schema = z.object({
  precoSaidaUsdBu: z.number().positive().optional(),
  precoSaidaBrlSc: z.number().positive().optional(),
  cambioSaidaUsdBrl: z.number().positive(),
  fechadoEm: z.string().datetime().optional(),
})

const CULTURA_TO_CBOT: Record<string, CulturaCbot> = {
  soja: 'ZS',
  milho: 'ZC',
  trigo: 'ZW',
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const data = schema.parse(await request.json())
  const pos = await db.posicaoHedge.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!pos) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  if (pos.status === 'fechada' || pos.status === 'liquidada') {
    return NextResponse.json({ error: 'Posição já fechada' }, { status: 400 })
  }

  let pnlFinalUSD: number | null = null
  let pnlFinalBRL: number | null = null

  const sym = pos.cultura ? CULTURA_TO_CBOT[pos.cultura] : null
  if (
    sym &&
    pos.precoEntradaUsdBu !== null &&
    pos.cambioEntradaUsdBrl !== null &&
    data.precoSaidaUsdBu
  ) {
    const r = calcularPnLFinal(
      {
        tipo: pos.tipo as 'long' | 'short',
        qtdContratos: pos.qtdContratos,
        cultura: sym,
        precoEntradaUsdBu: Number(pos.precoEntradaUsdBu),
        cambioEntradaUsdBrl: Number(pos.cambioEntradaUsdBrl),
        corretagemUSD: Number(pos.corretagemUSD ?? 0),
      },
      {
        precoSaidaUsdBu: data.precoSaidaUsdBu,
        cambioSaidaUsdBrl: data.cambioSaidaUsdBrl,
      }
    )
    pnlFinalUSD = r.pnlUSD
    pnlFinalBRL = r.pnlBRL
  }

  const updated = await db.posicaoHedge.update({
    where: { id: pos.id },
    data: {
      status: 'fechada',
      fechadoEm: data.fechadoEm ? new Date(data.fechadoEm) : new Date(),
      precoSaidaUsdBu: data.precoSaidaUsdBu ?? null,
      precoSaidaBrlSc: data.precoSaidaBrlSc ?? null,
      cambioSaidaUsdBrl: data.cambioSaidaUsdBrl,
      pnlFinalUSD,
      pnlFinalBRL,
    },
  })
  return NextResponse.json(updated)
}
