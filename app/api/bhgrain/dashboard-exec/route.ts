/**
 * GET /api/bhgrain/dashboard-exec
 *
 * Dashboard executivo: visão de dono. Foco em decisão, não operação.
 *
 * Retorna:
 *   - mes: { receita, count, ticketMedio, hitRate } do mês corrente
 *   - mesAnterior: idem do mês passado (pra comparação)
 *   - tendencia6m: [{ mes: '2026-01', receita, count, hitRate }, ...]
 *   - hitRatePorCanal: { telefone: %, web: %, whatsapp: %, ia_autonomo: % }
 *   - topClientes: top 10 por receita acumulada nos últimos 6 meses
 *   - funil: { rascunho, enviada, em_negociacao, aceita, perdida }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

const STATUS_SUCESSO = new Set(['aceita', 'aprovada', 'fechado', 'sucesso', 'concluido', 'faturado'])
const STATUS_PERDA = new Set(['rejeitada', 'recusada', 'expirada', 'perdida', 'cancelada'])
const STATUS_ABERTO = new Set(['rascunho', 'enviada', 'em_negociacao'])

interface MesAgg {
  receita: number
  count: number
  countDecididas: number
  countGanhas: number
}

interface PorMes {
  mes: string
  receita: number
  count: number
  hitRate: number
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const now = new Date()
    const inicioSeisMeses = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1)
    const inicioMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const fimMesAnterior = inicioMes

    // Uma só query — todas as propostas do workspace nos últimos 6 meses
    // OU propostas em aberto (sem limite temporal, pra funil)
    const propostas = await db.proposta.findMany({
      where: {
        ...scope.whereOwn(),
        OR: [
          { atualizadaEm: { gte: inicioSeisMeses } },
          { status: { in: [...STATUS_ABERTO] } },
        ],
      },
      select: {
        status: true,
        valorTotal: true,
        atualizadaEm: true,
        criadaEm: true,
        canalAutorizacao: true,
        clienteId: true,
        cliente: { select: { nome: true } },
      },
    })

    // Mês atual + mês anterior
    const mesAgg = aggMes(propostas, inicioMes, now)
    const mesAntAgg = aggMes(propostas, inicioMesAnterior, fimMesAnterior)

    // Tendência por mês (6 meses)
    const porMesMap = new Map<string, MesAgg>()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      porMesMap.set(key, { receita: 0, count: 0, countDecididas: 0, countGanhas: 0 })
    }
    for (const p of propostas) {
      const d = p.atualizadaEm
      if (d < inicioSeisMeses) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const slot = porMesMap.get(key)
      if (!slot) continue
      const status = p.status.toLowerCase()
      const valor = Number(p.valorTotal)
      if (STATUS_SUCESSO.has(status)) {
        slot.receita += valor
        slot.count++
        slot.countDecididas++
        slot.countGanhas++
      } else if (STATUS_PERDA.has(status)) {
        slot.countDecididas++
      }
    }
    const tendencia6m: PorMes[] = Array.from(porMesMap.entries()).map(([mes, a]) => ({
      mes,
      receita: a.receita,
      count: a.count,
      hitRate: a.countDecididas > 0 ? a.countGanhas / a.countDecididas : 0,
    }))

    // Hit rate por canal (últimos 6 meses)
    const canalAgg = new Map<string, { ganhas: number; decididas: number; receita: number }>()
    for (const p of propostas) {
      if (p.atualizadaEm < inicioSeisMeses) continue
      const status = p.status.toLowerCase()
      const canal = p.canalAutorizacao ?? 'web'
      if (!canalAgg.has(canal)) {
        canalAgg.set(canal, { ganhas: 0, decididas: 0, receita: 0 })
      }
      const slot = canalAgg.get(canal)!
      const valor = Number(p.valorTotal)
      if (STATUS_SUCESSO.has(status)) {
        slot.ganhas++
        slot.decididas++
        slot.receita += valor
      } else if (STATUS_PERDA.has(status)) {
        slot.decididas++
      }
    }
    const hitRatePorCanal = Array.from(canalAgg.entries())
      .map(([canal, a]) => ({
        canal,
        hitRate: a.decididas > 0 ? a.ganhas / a.decididas : 0,
        ganhas: a.ganhas,
        decididas: a.decididas,
        receita: a.receita,
      }))
      .sort((a, b) => b.receita - a.receita)

    // Top clientes (receita acumulada últimos 6 meses)
    const clienteAgg = new Map<string, { nome: string; receita: number; count: number }>()
    for (const p of propostas) {
      if (p.atualizadaEm < inicioSeisMeses) continue
      const status = p.status.toLowerCase()
      if (!STATUS_SUCESSO.has(status)) continue
      const key = p.clienteId
      const nome = p.cliente?.nome ?? '—'
      if (!clienteAgg.has(key)) clienteAgg.set(key, { nome, receita: 0, count: 0 })
      const slot = clienteAgg.get(key)!
      slot.receita += Number(p.valorTotal)
      slot.count++
    }
    const topClientes = Array.from(clienteAgg.entries())
      .map(([clienteId, a]) => ({ clienteId, ...a }))
      .sort((a, b) => b.receita - a.receita)
      .slice(0, 10)

    // Funil — status correntes (snapshot, não temporal)
    const funil = {
      rascunho: 0,
      enviada: 0,
      em_negociacao: 0,
      aceita: 0,
      perdida: 0,
    }
    for (const p of propostas) {
      const s = p.status.toLowerCase()
      if (s === 'rascunho') funil.rascunho++
      else if (s === 'enviada') funil.enviada++
      else if (s === 'em_negociacao') funil.em_negociacao++
      else if (STATUS_SUCESSO.has(s)) funil.aceita++
      else if (STATUS_PERDA.has(s)) funil.perdida++
    }

    return NextResponse.json({
      mes: aggToOut(mesAgg),
      mesAnterior: aggToOut(mesAntAgg),
      tendencia6m,
      hitRatePorCanal,
      topClientes,
      funil,
      janela: {
        inicio: inicioSeisMeses.toISOString(),
        fim: now.toISOString(),
      },
    })
  } catch (error) {
    console.error('Dashboard exec error:', error)
    return NextResponse.json({ error: 'Erro ao carregar dashboard' }, { status: 500 })
  }
}

interface PropostaParcial {
  status: string
  valorTotal: { toString(): string } | number
  atualizadaEm: Date
}

function aggMes(propostas: PropostaParcial[], inicio: Date, fim: Date): MesAgg {
  const agg: MesAgg = { receita: 0, count: 0, countDecididas: 0, countGanhas: 0 }
  for (const p of propostas) {
    if (p.atualizadaEm < inicio || p.atualizadaEm >= fim) continue
    const status = p.status.toLowerCase()
    const valor = Number(p.valorTotal)
    if (STATUS_SUCESSO.has(status)) {
      agg.receita += valor
      agg.count++
      agg.countDecididas++
      agg.countGanhas++
    } else if (STATUS_PERDA.has(status)) {
      agg.countDecididas++
    }
  }
  return agg
}

function aggToOut(a: MesAgg) {
  return {
    receita: a.receita,
    count: a.count,
    ticketMedio: a.count > 0 ? a.receita / a.count : 0,
    hitRate: a.countDecididas > 0 ? a.countGanhas / a.countDecididas : 0,
  }
}
