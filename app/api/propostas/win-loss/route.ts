/**
 * GET /api/propostas/win-loss
 *
 * Win/Loss analytics. Agrega propostas decididas (aceitas + perdidas) nos
 * últimos 90 dias e retorna:
 *   - Total ganhas, perdidas, taxa de conversão
 *   - Distribuição de motivos de perda (lossReason)
 *   - Hit rate por canal (telefone/whatsapp/web/ia_autonomo)
 *   - Hit rate por commodity (soja/milho/...)
 *   - Hit rate por vendedor (top 10)
 *   - Tempo médio de decisão (criadaEm → atualizadaEm)
 *
 * Filtros opcionais: ?dias=90&commodity=soja&vendedorId=...
 */

import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import {
  STATUS_FECHADOS_SUCESSO,
  STATUS_FECHADOS_PERDA,
} from '@/lib/propostas/status'
import { primeiroGrao } from '@/lib/propostas/grao-item'

const LOSS_REASON_LABEL: Record<string, string> = {
  preco: 'Preço',
  concorrencia: 'Concorrência',
  prazo: 'Prazo',
  qualidade: 'Qualidade',
  logistica: 'Logística',
  sem_resposta: 'Sem resposta',
  outro: 'Outro',
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const dias = Math.min(365, Math.max(7, parseInt(searchParams.get('dias') ?? '90', 10)))
    const desde = new Date(Date.now() - dias * 86_400_000)
    const commodityFiltro = searchParams.get('commodity')?.toLowerCase() ?? null
    const vendedorFiltro = searchParams.get('vendedorId') ?? null

    const propostas = await db.proposta.findMany({
      where: {
        ...scope.whereOwn(),
        atualizadaEm: { gte: desde },
        ...(vendedorFiltro ? { vendedorId: vendedorFiltro } : {}),
      },
      select: {
        status: true,
        valorTotal: true,
        criadaEm: true,
        atualizadaEm: true,
        canalAutorizacao: true,
        lossReason: true,
        graos: true,
        vendedorId: true,
        vendedor: { select: { user: { select: { nome: true, email: true } } } },
      },
    })

    let ganhas = 0
    let perdidas = 0
    let receitaGanhas = 0
    let receitaPerdidasEstim = 0
    let somaTempoDecisaoMs = 0
    let countTempoDecisao = 0

    const lossReasonAgg = new Map<string, { count: number; valor: number }>()
    const canalAgg = new Map<string, { ganhas: number; perdidas: number; receita: number }>()
    const commodityAgg = new Map<string, { ganhas: number; perdidas: number; receita: number }>()
    const vendedorAgg = new Map<
      string,
      { nome: string; ganhas: number; perdidas: number; receita: number }
    >()

    for (const p of propostas) {
      const status = p.status.toLowerCase()
      const valor = Number(p.valorTotal)
      const canal = p.canalAutorizacao ?? 'web'
      const grao = primeiroGrao(p.graos)?.grao ?? 'desconhecido'

      // Filtro commodity (depois do fetch para usar primeiroGrao)
      if (commodityFiltro && grao !== commodityFiltro) continue

      const isGanha = STATUS_FECHADOS_SUCESSO.has(status)
      const isPerdida = STATUS_FECHADOS_PERDA.has(status)
      if (!isGanha && !isPerdida) continue

      if (isGanha) {
        ganhas++
        receitaGanhas += valor
      } else {
        perdidas++
        receitaPerdidasEstim += valor
        if (p.lossReason) {
          const slot = lossReasonAgg.get(p.lossReason) ?? { count: 0, valor: 0 }
          slot.count++
          slot.valor += valor
          lossReasonAgg.set(p.lossReason, slot)
        }
      }

      // Tempo de decisão
      const tempoMs = p.atualizadaEm.getTime() - p.criadaEm.getTime()
      if (tempoMs > 0 && tempoMs < 365 * 86_400_000) {
        somaTempoDecisaoMs += tempoMs
        countTempoDecisao++
      }

      // Por canal
      const cs = canalAgg.get(canal) ?? { ganhas: 0, perdidas: 0, receita: 0 }
      if (isGanha) {
        cs.ganhas++
        cs.receita += valor
      } else cs.perdidas++
      canalAgg.set(canal, cs)

      // Por commodity
      const cms = commodityAgg.get(grao) ?? { ganhas: 0, perdidas: 0, receita: 0 }
      if (isGanha) {
        cms.ganhas++
        cms.receita += valor
      } else cms.perdidas++
      commodityAgg.set(grao, cms)

      // Por vendedor
      if (p.vendedorId) {
        const nome =
          p.vendedor?.user?.nome ?? p.vendedor?.user?.email ?? 'vendedor desconhecido'
        const vs = vendedorAgg.get(p.vendedorId) ?? {
          nome,
          ganhas: 0,
          perdidas: 0,
          receita: 0,
        }
        if (isGanha) {
          vs.ganhas++
          vs.receita += valor
        } else vs.perdidas++
        vendedorAgg.set(p.vendedorId, vs)
      }
    }

    const totalDecididas = ganhas + perdidas
    const hitRate = totalDecididas > 0 ? ganhas / totalDecididas : 0
    const tempoMedioDecisaoHoras =
      countTempoDecisao > 0 ? somaTempoDecisaoMs / countTempoDecisao / 3600_000 : 0

    const lossReasons = Array.from(lossReasonAgg.entries())
      .map(([reason, a]) => ({
        reason,
        label: LOSS_REASON_LABEL[reason] ?? reason,
        count: a.count,
        valor: a.valor,
        pct: perdidas > 0 ? a.count / perdidas : 0,
      }))
      .sort((a, b) => b.count - a.count)

    const porCanal = Array.from(canalAgg.entries())
      .map(([canal, a]) => ({
        canal,
        ganhas: a.ganhas,
        perdidas: a.perdidas,
        receita: a.receita,
        hitRate: a.ganhas + a.perdidas > 0 ? a.ganhas / (a.ganhas + a.perdidas) : 0,
      }))
      .sort((a, b) => b.receita - a.receita)

    const porCommodity = Array.from(commodityAgg.entries())
      .map(([commodity, a]) => ({
        commodity,
        ganhas: a.ganhas,
        perdidas: a.perdidas,
        receita: a.receita,
        hitRate: a.ganhas + a.perdidas > 0 ? a.ganhas / (a.ganhas + a.perdidas) : 0,
      }))
      .sort((a, b) => b.receita - a.receita)

    const porVendedor = Array.from(vendedorAgg.entries())
      .map(([vendedorId, a]) => ({
        vendedorId,
        nome: a.nome,
        ganhas: a.ganhas,
        perdidas: a.perdidas,
        receita: a.receita,
        hitRate: a.ganhas + a.perdidas > 0 ? a.ganhas / (a.ganhas + a.perdidas) : 0,
      }))
      .sort((a, b) => b.receita - a.receita)
      .slice(0, 10)

    return NextResponse.json({
      janela: {
        dias,
        desde: desde.toISOString(),
        ate: new Date().toISOString(),
      },
      resumo: {
        ganhas,
        perdidas,
        totalDecididas,
        hitRate,
        receitaGanhas,
        receitaPerdidasEstim,
        tempoMedioDecisaoHoras,
      },
      lossReasons,
      porCanal,
      porCommodity,
      porVendedor,
    })
  } catch (error) {
    console.error('Win/Loss error:', error)
    return NextResponse.json({ error: 'Erro ao calcular Win/Loss' }, { status: 500 })
  }
}
