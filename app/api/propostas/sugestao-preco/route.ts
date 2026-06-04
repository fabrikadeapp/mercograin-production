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

    // I2 — Multi-grão: aceita ?graos=soja,milho ou ?grao=soja (single legacy)
    const graosParam = searchParams.get('graos')
    const graoSingleParam = searchParams.get('grao')?.toLowerCase() as Grao | null
    const clienteId = searchParams.get('clienteId') ?? null

    let graosSolicitados: Grao[] = []
    if (graosParam) {
      const tokens = graosParam
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
      const invalidos = tokens.filter((t) => !GRAOS_VALIDOS.includes(t as Grao))
      if (invalidos.length > 0) {
        return NextResponse.json(
          {
            error: `Grãos inválidos: ${invalidos.join(', ')}`,
            graos: GRAOS_VALIDOS,
          },
          { status: 400 }
        )
      }
      graosSolicitados = tokens as Grao[]
    } else if (graoSingleParam && GRAOS_VALIDOS.includes(graoSingleParam)) {
      graosSolicitados = [graoSingleParam]
    }

    if (graosSolicitados.length === 0) {
      return NextResponse.json(
        { error: 'Informe ?grao=X ou ?graos=X,Y,Z', graos: GRAOS_VALIDOS },
        { status: 400 }
      )
    }

    // ── MULTI-GRÃO ── Se mais de um, faz loop e retorna mapa { grao: sugestao }
    if (graosSolicitados.length > 1) {
      const resultados: Record<string, unknown> = {}
      for (const g of graosSolicitados) {
        resultados[g] = await sugerirParaGrao(g, clienteId, scope)
      }
      return NextResponse.json({ multi: true, porGrao: resultados })
    }

    // ── SINGLE ── Comportamento legado para retrocompatibilidade
    const grao = graosSolicitados[0]
    const out = await sugerirParaGrao(grao, clienteId, scope)
    return NextResponse.json(out)
  } catch (error) {
    console.error('Sugestao preco error:', error)
    return NextResponse.json({ error: 'Erro ao gerar sugestão' }, { status: 500 })
  }
}

interface ScopeLike {
  workspaceId: string
}

async function sugerirParaGrao(
  grao: Grao,
  clienteId: string | null,
  scope: ScopeLike
) {
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
      mercadoBrlTon = (usdBu * usdbrl * 1000) / kgPorBu
      fonteMercado = 'Cotacao'
      capturadoEm = ultimaCotacao.data
    }
  }

  // 2. Margem default
  const margins = await getMarginMap(scope.workspaceId)
  const margemRaw = margins[grao]
  const margemDefault = margemRaw != null ? margemRaw / 100 : null

  // 3. Histórico do cliente+grão (max 10 últimos fechamentos)
  const historicoCliente: PropostaHistorica[] = []
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

  return calcularSugestaoPreco({
    grao,
    mercadoBrlTon,
    fonteMercado,
    capturadoEm,
    margemDefault,
    historicoCliente,
  })
}
