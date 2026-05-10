import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { resumirLongShort } from '@/lib/hedge/exposicao'

export async function GET(_request: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const posicoes = await db.posicaoHedge.findMany({
    where: { ...scope.whereOwn(), status: 'aberta' },
  })

  const resumo = resumirLongShort(
    posicoes.map((p) => ({
      cultura: p.cultura ?? 'cambial',
      tipo: p.tipo as 'long' | 'short',
      qtdContratos: Number(p.qtdContratos),
      notionalUSD:
        Number(p.qtdContratos) *
        5000 *
        Number(p.precoEntradaUsdBu ?? 0),
    }))
  )

  return NextResponse.json({ resumo, total: posicoes.length })
}
