/**
 * QW10 — Aging de boletos em aberto.
 *
 * GET /api/relatorios/aging-boletos
 *
 * Agrupa boletos status='aberto' por faixa de atraso:
 *   - a_vencer: vencimento >= hoje
 *   - 1-30d, 31-60d, 61-90d, 90d+
 *
 * Multi-tenant via scope.whereOwn().
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type FaixaKey = 'a_vencer' | '1-30d' | '31-60d' | '61-90d' | '90d+'

interface BoletoBreakdown {
  id: string
  numero: string
  clienteNome: string
  valor: number
  vencimento: string
  diasAtraso: number
}

interface FaixaResult {
  faixa: FaixaKey
  qtd: number
  valor: number
  boletos: BoletoBreakdown[]
}

function classify(diasAtraso: number): FaixaKey {
  if (diasAtraso <= 0) return 'a_vencer'
  if (diasAtraso <= 30) return '1-30d'
  if (diasAtraso <= 60) return '31-60d'
  if (diasAtraso <= 90) return '61-90d'
  return '90d+'
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const includeBoletos = searchParams.get('includeBoletos') !== 'false'

    const where: any = scope.whereOwn({ status: 'aberto' })
    const boletos = await db.boleto.findMany({
      where,
      include: {
        cliente: { select: { nome: true } },
      },
      orderBy: { vencimento: 'asc' },
    })

    const now = new Date()
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    )

    const init = (faixa: FaixaKey): FaixaResult => ({
      faixa,
      qtd: 0,
      valor: 0,
      boletos: [],
    })
    const groups: Record<FaixaKey, FaixaResult> = {
      a_vencer: init('a_vencer'),
      '1-30d': init('1-30d'),
      '31-60d': init('31-60d'),
      '61-90d': init('61-90d'),
      '90d+': init('90d+'),
    }
    let totalQtd = 0
    let totalValor = 0

    for (const b of boletos) {
      const venc = new Date(b.vencimento)
      const diff = startOfToday.getTime() - venc.getTime()
      const diasAtraso = Math.floor(diff / 86_400_000)
      const key = classify(diasAtraso)
      const valor = Number(b.valor)
      groups[key].qtd++
      groups[key].valor += valor
      totalQtd++
      totalValor += valor
      if (includeBoletos) {
        groups[key].boletos.push({
          id: b.id,
          numero: b.numero,
          clienteNome: b.cliente?.nome ?? '',
          valor,
          vencimento: b.vencimento.toISOString(),
          diasAtraso,
        })
      }
    }

    const faixas: FaixaResult[] = (
      ['a_vencer', '1-30d', '31-60d', '61-90d', '90d+'] as FaixaKey[]
    ).map((k) => {
      const g = groups[k]
      return {
        faixa: g.faixa,
        qtd: g.qtd,
        valor: Math.round(g.valor * 100) / 100,
        boletos: includeBoletos ? g.boletos : [],
      }
    })

    return NextResponse.json({
      total: { qtd: totalQtd, valor: Math.round(totalValor * 100) / 100 },
      faixas,
      geradoEm: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Aging boletos error:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar aging de boletos' },
      { status: 500 }
    )
  }
}
