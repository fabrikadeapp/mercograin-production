/**
 * Aging de pagamentos (MovimentoFinanceiro tipo='despesa' não conciliados).
 * Espelha aging-boletos: classifica por dias desde data prevista (campo data).
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type FaixaKey = 'a_vencer' | '1-30d' | '31-60d' | '61-90d' | '90d+'

function classify(diasAtraso: number): FaixaKey {
  if (diasAtraso <= 0) return 'a_vencer'
  if (diasAtraso <= 30) return '1-30d'
  if (diasAtraso <= 60) return '31-60d'
  if (diasAtraso <= 90) return '61-90d'
  return '90d+'
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const natureza = searchParams.get('natureza') // opcional ('comissao', 'frete', ...)
  const includeItems = searchParams.get('includeItems') !== 'false'

  const where: any = scope.whereOwn({ tipo: 'despesa', conciliado: false })
  if (natureza) where.natureza = natureza

  const movimentos = await db.movimentoFinanceiro.findMany({
    where,
    orderBy: { data: 'asc' },
  })

  const now = new Date()
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )

  type Faixa = {
    faixa: FaixaKey
    qtd: number
    valor: number
    items: Array<{
      id: string
      descricao: string
      natureza: string
      valor: number
      data: string
      diasAtraso: number
    }>
  }
  const init = (faixa: FaixaKey): Faixa => ({
    faixa,
    qtd: 0,
    valor: 0,
    items: [],
  })
  const groups: Record<FaixaKey, Faixa> = {
    a_vencer: init('a_vencer'),
    '1-30d': init('1-30d'),
    '31-60d': init('31-60d'),
    '61-90d': init('61-90d'),
    '90d+': init('90d+'),
  }
  let totalQtd = 0
  let totalValor = 0

  for (const m of movimentos) {
    const d = new Date(m.data)
    const dias = Math.floor((today.getTime() - d.getTime()) / 86_400_000)
    const key = classify(dias)
    const v = Number(m.valor)
    groups[key].qtd++
    groups[key].valor += v
    totalQtd++
    totalValor += v
    if (includeItems) {
      groups[key].items.push({
        id: m.id,
        descricao: m.descricao,
        natureza: m.natureza,
        valor: v,
        data: m.data.toISOString(),
        diasAtraso: dias,
      })
    }
  }

  const faixas = (
    ['a_vencer', '1-30d', '31-60d', '61-90d', '90d+'] as FaixaKey[]
  ).map((k) => ({
    faixa: groups[k].faixa,
    qtd: groups[k].qtd,
    valor: Math.round(groups[k].valor * 100) / 100,
    items: includeItems ? groups[k].items : [],
  }))

  return NextResponse.json({
    total: { qtd: totalQtd, valor: Math.round(totalValor * 100) / 100 },
    faixas,
  })
}
