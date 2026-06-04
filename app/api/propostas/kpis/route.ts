/**
 * GET /api/propostas/kpis
 * KPIs do book de propostas — usado na header da página /propostas.
 *
 * Retorna:
 *   {
 *     emAberto:        { count: n, valor: R$ },
 *     vencendoHoje:    { count: n, valor: R$ },
 *     vencendoEm3d:    { count: n, valor: R$ },
 *     vencidas:        { count: n, valor: R$ },
 *     fechadasNoMes:   { count: n, valor: R$ },
 *     hitRateMensal:   number (0..1)
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

const STATUS_ABERTOS = new Set(['rascunho', 'enviada', 'em_negociacao'])
const STATUS_FECHADOS_SUCESSO = new Set(['aceita', 'aprovada', 'fechado', 'sucesso', 'concluido', 'faturado'])
const STATUS_FECHADOS_PERDA = new Set(['rejeitada', 'recusada', 'expirada', 'perdida', 'cancelada'])

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const now = new Date()
    const hojeIni = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const hojeFim = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    const em3d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 23, 59, 59, 999)
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1)

    const propostas = await db.proposta.findMany({
      where: scope.whereOwn(),
      select: {
        status: true,
        valorTotal: true,
        validadeEm: true,
        atualizadaEm: true,
        criadaEm: true,
        enviadaEm: true,
        vistaEm: true,
      },
    })

    const agg = {
      emAberto: { count: 0, valor: 0 },
      vencendoHoje: { count: 0, valor: 0 },
      vencendoEm3d: { count: 0, valor: 0 },
      vencidas: { count: 0, valor: 0 },
      fechadasNoMes: { count: 0, valor: 0 },
      hitRateMensal: 0,
      taxaVisualizacao: 0,
    }

    let enviadasTotal = 0
    let vistasTotal = 0
    let totalDecididasMes = 0
    let ganhasMes = 0

    for (const p of propostas) {
      const status = p.status.toLowerCase()
      const valor = Number(p.valorTotal)
      const validade = p.validadeEm

      if (STATUS_ABERTOS.has(status)) {
        agg.emAberto.count++
        agg.emAberto.valor += valor

        if (validade < hojeIni) {
          agg.vencidas.count++
          agg.vencidas.valor += valor
        } else if (validade <= hojeFim) {
          agg.vencendoHoje.count++
          agg.vencendoHoje.valor += valor
        } else if (validade <= em3d) {
          agg.vencendoEm3d.count++
          agg.vencendoEm3d.valor += valor
        }
      }

      // Métricas do mês corrente — usa atualizadaEm (snapshot da última mudança de status)
      if (p.atualizadaEm >= inicioMes) {
        if (STATUS_FECHADOS_SUCESSO.has(status)) {
          agg.fechadasNoMes.count++
          agg.fechadasNoMes.valor += valor
          totalDecididasMes++
          ganhasMes++
        } else if (STATUS_FECHADOS_PERDA.has(status)) {
          totalDecididasMes++
        }
      }

      // Taxa de visualização: das propostas enviadas, quantas o cliente abriu?
      if (p.enviadaEm) {
        enviadasTotal++
        if (p.vistaEm) vistasTotal++
      }
    }

    agg.hitRateMensal = totalDecididasMes > 0 ? ganhasMes / totalDecididasMes : 0
    agg.taxaVisualizacao = enviadasTotal > 0 ? vistasTotal / enviadasTotal : 0

    return NextResponse.json(agg)
  } catch (error) {
    console.error('Get KPIs propostas error:', error)
    return NextResponse.json({ error: 'Erro ao calcular KPIs' }, { status: 500 })
  }
}
