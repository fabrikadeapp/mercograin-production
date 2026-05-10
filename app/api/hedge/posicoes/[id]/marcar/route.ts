import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { calcularPnL } from '@/lib/hedge/pnl'
import {
  CBOT_CONTRATO,
  precoBrlScParaUsdBu,
  type CulturaCbot,
} from '@/lib/hedge/conversao'

const CULTURA_TO_CBOT: Record<string, CulturaCbot> = {
  soja: 'ZS',
  milho: 'ZC',
  trigo: 'ZW',
}

/**
 * POST /api/hedge/posicoes/{id}/marcar
 * Body opcional: { precoMercadoUsdBu, cambioUsdBrl, data }
 * Se omitidos, busca da última Cotacao + última TaxaCambio.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const pos = await db.posicaoHedge.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!pos) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  if (pos.status !== 'aberta') {
    return NextResponse.json(
      { error: 'Apenas posições abertas podem ser marcadas' },
      { status: 400 }
    )
  }

  const sym = pos.cultura ? CULTURA_TO_CBOT[pos.cultura] : null
  if (
    !sym ||
    pos.precoEntradaUsdBu === null ||
    pos.cambioEntradaUsdBrl === null
  ) {
    return NextResponse.json(
      { error: 'Posição sem dados suficientes (cultura/preço/câmbio entrada)' },
      { status: 400 }
    )
  }

  // Resolver câmbio
  let cambio = body?.cambioUsdBrl
  let cambioRefId: string | null = null
  let cambioRefData: Date | null = null
  if (!cambio) {
    const tx = await db.taxaCambio.findFirst({
      where: { origem: 'USD', destino: 'BRL' },
      orderBy: { data: 'desc' },
    })
    if (tx) {
      cambio = Number(tx.taxa)
      cambioRefId = tx.id
      cambioRefData = tx.data
    }
  }
  if (!cambio) {
    return NextResponse.json(
      { error: 'Câmbio USD/BRL indisponível — informe explicitamente' },
      { status: 400 }
    )
  }

  // Resolver preço de mercado
  let precoUsdBu = body?.precoMercadoUsdBu
  let precoBrlSc = body?.precoMercadoBrlSc
  let cotacaoRefId: string | null = null
  let cotacaoRefData: Date | null = null
  if (!precoUsdBu) {
    const cot = await db.cotacao.findFirst({
      where: { grao: pos.cultura ?? '' },
      orderBy: { data: 'desc' },
    })
    if (cot) {
      cotacaoRefId = cot.id
      cotacaoRefData = cot.data
      // Cotacao.preco vem em R$/sc (CEPEA). Inverte pra USD/bu.
      const brlSc = Number(cot.preco)
      precoBrlSc = brlSc
      precoUsdBu = precoBrlScParaUsdBu(
        brlSc,
        cambio,
        CBOT_CONTRATO[sym].kgPorBushel
      )
    }
  }
  if (!precoUsdBu) {
    return NextResponse.json(
      { error: 'Preço de mercado indisponível — informe explicitamente' },
      { status: 400 }
    )
  }

  const r = calcularPnL(
    {
      tipo: pos.tipo as 'long' | 'short',
      qtdContratos: pos.qtdContratos,
      cultura: sym,
      precoEntradaUsdBu: Number(pos.precoEntradaUsdBu),
      cambioEntradaUsdBrl: Number(pos.cambioEntradaUsdBrl),
      corretagemUSD: Number(pos.corretagemUSD ?? 0),
    },
    { precoMercadoUsdBu: precoUsdBu, cambioMercadoUsdBrl: cambio }
  )

  const dataMarcacao = body?.data ? new Date(body.data) : new Date()
  const dia = new Date(
    Date.UTC(
      dataMarcacao.getUTCFullYear(),
      dataMarcacao.getUTCMonth(),
      dataMarcacao.getUTCDate()
    )
  )

  // Buscar marcação anterior pra calcular variação dia
  const previa = await db.marcacaoMercado.findFirst({
    where: { posicaoHedgeId: pos.id, data: { lt: dia } },
    orderBy: { data: 'desc' },
  })

  const variacaoDiaUSD = previa
    ? r.pnlUSD - Number(previa.pnlUnrealizedUSD)
    : null
  const variacaoDiaBRL = previa
    ? r.pnlBRL - Number(previa.pnlUnrealizedBRL)
    : null

  const inputsSnapshot = {
    cotacaoId: cotacaoRefId,
    cotacaoData: cotacaoRefData?.toISOString?.() ?? null,
    precoMercadoBrlSc: precoBrlSc ?? null,
    precoMercadoUsdBu: precoUsdBu,
    cambioId: cambioRefId,
    cambioData: cambioRefData?.toISOString?.() ?? null,
    cambioUsdBrl: cambio,
    overrideManual:
      body?.precoMercadoUsdBu != null ||
      body?.precoMercadoBrlSc != null ||
      body?.cambioUsdBrl != null,
    pnlFormula:
      'pnl_usd = sinal * (mkt - entrada) * qtdContratos * 5000 - corretagem',
    kgPorBushel: CBOT_CONTRATO[sym].kgPorBushel,
  }
  const created = await db.marcacaoMercado.upsert({
    where: { posicaoHedgeId_data: { posicaoHedgeId: pos.id, data: dia } },
    create: {
      workspaceId: scope.workspaceId,
      posicaoHedgeId: pos.id,
      data: dia,
      precoMercadoUsdBu: precoUsdBu,
      precoMercadoBrlSc: precoBrlSc ?? null,
      cambioUsdBrl: cambio,
      pnlUnrealizedUSD: r.pnlUSD,
      pnlUnrealizedBRL: r.pnlBRL,
      variacaoDiaUSD,
      variacaoDiaBRL,
      inputsSnapshot,
      calcMetodo: 'marcacao_manual',
      calcVersao: 'v1',
    },
    update: {
      precoMercadoUsdBu: precoUsdBu,
      precoMercadoBrlSc: precoBrlSc ?? null,
      cambioUsdBrl: cambio,
      pnlUnrealizedUSD: r.pnlUSD,
      pnlUnrealizedBRL: r.pnlBRL,
      variacaoDiaUSD,
      variacaoDiaBRL,
      inputsSnapshot,
      calcMetodo: 'marcacao_manual',
      calcVersao: 'v1',
    },
  })

  return NextResponse.json({ marcacao: created, pnl: r })
}
