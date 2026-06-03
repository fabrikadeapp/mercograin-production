/**
 * GET /api/propostas/sugestao-preco?grao=soja&clienteId=...&tipo=venda
 *
 * Retorna sugestão determinística de preço combinando:
 *   - Mercado atual (Cotacao mais recente do workspace)
 *   - Margem default do workspace para a commodity
 *   - Histórico de fechamentos do cliente+grão (banda + prêmio típico)
 *
 * Função pura em lib/propostas/sugestao-preco.ts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { getMarginMap } from '@/lib/bhgrain/margin-rules'
import {
  calcularSugestaoPreco,
  type PropostaHistorica,
} from '@/lib/propostas/sugestao-preco'
import { KG_POR_BU, type Grao } from '@/lib/cotacoes/unidades'

const GRAOS_VALIDOS: Grao[] = [
  'soja',
  'milho',
  'trigo',
  'sorgo',
  'aveia',
  'arroz',
  'cafe',
  'algodao',
]

const STATUS_FECHADOS_SUCESSO = ['aceita', 'aprovada', 'fechado', 'sucesso', 'concluido', 'faturado']

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const grao = searchParams.get('grao')?.toLowerCase() as Grao | null
    const clienteId = searchParams.get('clienteId') ?? null

    if (!grao || !GRAOS_VALIDOS.includes(grao)) {
      return NextResponse.json(
        { error: 'Parâmetro grao inválido', graos: GRAOS_VALIDOS },
        { status: 400 }
      )
    }

    // 1. Mercado atual: pega Cotacao mais recente (global, não tem workspaceId)
    // Cotacao.preco está em cents/bushel (CBOT nativo) + dolarReal incluso.
    const ultimaCotacao = await db.cotacao.findFirst({
      where: { grao },
      orderBy: { data: 'desc' },
      select: { preco: true, data: true, fonte: true, dolarReal: true },
    })

    let mercadoBrlTon: number | null = null
    let fonteMercado: 'CBOT' | 'Cotacao' | 'indisponivel' = 'indisponivel'
    let capturadoEm = new Date()

    if (ultimaCotacao && ultimaCotacao.dolarReal != null) {
      const centsBu = Number(ultimaCotacao.preco)
      const usdBu = centsBu / 100
      const usdbrl = Number(ultimaCotacao.dolarReal)
      const kgPorBu = KG_POR_BU[grao]
      if (kgPorBu > 0 && usdbrl > 0) {
        // R$/t = (USD/bu × USDBRL × 1000) / kg/bu
        mercadoBrlTon = (usdBu * usdbrl * 1000) / kgPorBu
        fonteMercado = 'Cotacao'
        capturadoEm = ultimaCotacao.data
      }
    }

    // 2. Margem default
    const margins = await getMarginMap(scope.workspaceId)
    // margemPercent vem em 0..100; sugestao-preco espera 0..1
    const margemRaw = margins[grao]
    const margemDefault = margemRaw != null ? margemRaw / 100 : null

    // 3. Histórico do cliente+grão (max 10 últimos fechamentos)
    let historicoCliente: PropostaHistorica[] = []
    if (clienteId) {
      const fechadas = await db.proposta.findMany({
        where: {
          workspaceId: scope.workspaceId,
          clienteId,
          status: { in: STATUS_FECHADOS_SUCESSO },
        },
        orderBy: { atualizadaEm: 'desc' },
        take: 10,
        select: {
          graos: true,
          marketPriceAtCreation: true,
          atualizadaEm: true,
        },
      })

      for (const p of fechadas) {
        const graoArr = Array.isArray(p.graos)
          ? (p.graos as Array<Record<string, unknown>>)
          : []
        // Pega o primeiro item que casa com a commodity solicitada
        const item = graoArr.find(
          (g) => String(g.grao ?? '').toLowerCase() === grao
        )
        if (!item) continue
        const preco = Number(item.preco ?? 0)
        if (preco <= 0) continue
        const market =
          p.marketPriceAtCreation != null ? Number(p.marketPriceAtCreation) : null
        historicoCliente.push({
          precoBrlTon: preco,
          marketBrlTon: market && market > 0 ? market : null,
          data: p.atualizadaEm,
        })
      }
    }

    const out = calcularSugestaoPreco({
      grao,
      mercadoBrlTon,
      fonteMercado,
      capturadoEm,
      margemDefault,
      historicoCliente,
    })

    return NextResponse.json(out)
  } catch (error) {
    console.error('Sugestao preco error:', error)
    return NextResponse.json({ error: 'Erro ao gerar sugestão' }, { status: 500 })
  }
}
