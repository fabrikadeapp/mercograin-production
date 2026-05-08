import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { codigoVencimento, labelVencimento } from '@/lib/futuros/codigos'

export const dynamic = 'force-dynamic'

interface BookSide {
  price: number
  volumeSc: number
  count: number
  source?: string | null
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const grao = (searchParams.get('grao') || 'soja').toLowerCase()

    const rows = await db.contratoFuturo.findMany({
      where: { ...scope.whereOwn(), grao, status: 'ativo' },
      orderBy: [{ vencimento: 'asc' }, { criadoEm: 'desc' }],
      include: { cliente: { select: { nome: true } } },
    })

    const grupos = new Map<
      string,
      {
        ymd: string
        codigo: string
        vencimentoLabel: string
        vencimentoDate: Date
        bid: BookSide | null
        ask: BookSide | null
      }
    >()

    for (const r of rows) {
      const d = new Date(r.vencimento)
      const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
      if (!grupos.has(ymd)) {
        grupos.set(ymd, {
          ymd,
          codigo: codigoVencimento(d),
          vencimentoLabel: labelVencimento(d),
          vencimentoDate: d,
          bid: null,
          ask: null,
        })
      }
      const g = grupos.get(ymd)!
      const preco = Number(r.precoSc)
      const source = r.cliente?.nome ?? null
      if (r.lado === 'compra') {
        // Best bid = MAIOR preço de compra
        if (!g.bid || preco > g.bid.price) {
          g.bid = { price: preco, volumeSc: r.volumeSc, count: 1, source }
        } else if (preco === g.bid.price) {
          g.bid.volumeSc += r.volumeSc
          g.bid.count += 1
        }
      } else if (r.lado === 'venda') {
        // Best ask = MENOR preço de venda
        if (!g.ask || preco < g.ask.price) {
          g.ask = { price: preco, volumeSc: r.volumeSc, count: 1, source }
        } else if (preco === g.ask.price) {
          g.ask.volumeSc += r.volumeSc
          g.ask.count += 1
        }
      }
    }

    const vencimentos = Array.from(grupos.values()).map((g) => ({
      ymd: g.ymd,
      codigo: g.codigo,
      vencimentoLabel: g.vencimentoLabel,
      bid: g.bid,
      ask: g.ask,
      spread:
        g.bid && g.ask
          ? Math.round((g.ask.price - g.bid.price) * 100) / 100
          : null,
      spreadPct:
        g.bid && g.ask && g.bid.price > 0
          ? Math.round(((g.ask.price - g.bid.price) / g.bid.price) * 10000) / 100
          : null,
    }))

    return NextResponse.json({
      grao,
      fonte: 'PHB Grain · Mesa B3',
      unidade: 'R$/sc 60kg',
      vencimentos,
      totalRegistros: rows.length,
    })
  } catch (error) {
    console.error('[futuros/book] erro:', error)
    return NextResponse.json(
      { error: 'Erro ao montar book' },
      { status: 500 },
    )
  }
}
