import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { calcularExposicao } from '@/lib/hedge/exposicao'

/**
 * GET /api/hedge/exposicao
 * Retorna exposição cambial agregada do workspace.
 *
 * Heurística:
 *  - Contratos comerciais com modalidade "fixo" e dataFim futura → expostos.
 *    Valor USD aproximado: usa proposta.valorTotal (BRL) convertido pela última taxa.
 *  - PosicaoHedge abertas: notional USD = qtdContratos * 5000 * precoEntradaUsdBu.
 *  - NDFs abertas (tipo='moeda', direcao='venda') também contam como cobertura.
 */
export async function GET(_request: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const hoje = new Date()

  const [contratos, posicoes, ndfs, taxa] = await Promise.all([
    db.contrato.findMany({
      where: {
        ...scope.whereOwn(),
        OR: [{ dataFim: null }, { dataFim: { gte: hoje } }],
      },
      include: { proposta: { select: { valorTotal: true } } },
    }),
    db.posicaoHedge.findMany({
      where: { ...scope.whereOwn(), status: 'aberta' },
    }),
    db.nDF.findMany({
      where: {
        ...scope.whereOwn(),
        status: 'aberta',
        tipo: 'moeda',
        direcao: 'venda',
      },
    }),
    db.taxaCambio.findFirst({
      where: { origem: 'USD', destino: 'BRL' },
      orderBy: { data: 'desc' },
    }),
  ])

  const cambio = taxa ? Number(taxa.taxa) : 5.0

  const contratosUSD = contratos.map((c) => ({
    valorTotalUSD: Number(c.proposta?.valorTotal ?? 0) / cambio,
    vencimento: c.dataFim ?? new Date(hoje.getTime() + 90 * 86400_000),
  }))

  const posicoesUSD = posicoes.map((p) => ({
    qtdContratosUSD:
      Number(p.qtdContratos) *
      5000 *
      Number(p.precoEntradaUsdBu ?? 0),
    tipo: p.tipo as 'long' | 'short',
  }))

  const ndfsCambial = ndfs.map((n) => ({
    notionalUSD: Number(n.notional),
    direcao: n.direcao as 'compra' | 'venda',
  }))

  const exposicao = calcularExposicao(contratosUSD, posicoesUSD, ndfsCambial, hoje)

  return NextResponse.json({
    exposicao,
    cambioReferencia: cambio,
    contratosCount: contratos.length,
    posicoesCount: posicoes.length,
    ndfCount: ndfs.length,
  })
}
