/**
 * lib/bi/corretor.ts
 * KPIs do corretor — desempenho individual + ranking dentro do workspace.
 */
import { db } from '@/lib/db'
import type { PeriodoBI } from './clevel'

export interface KpisCorretor {
  corretorId: string
  nome: string
  contratosFechados: number
  valorTotal: number
  propostasEnviadas: number
  propostasAceitas: number
  hitRate: number // %
  tempoMedioFechamento: number // dias
  comissaoAcumulada: number
  rankingPosicao: number | null
  periodo: { inicio: string; fim: string }
}

function defaultPeriodo(): PeriodoBI {
  const fim = new Date()
  const inicio = new Date(fim.getFullYear(), 0, 1)
  return { inicio, fim }
}

export async function kpisCorretor(
  corretorId: string,
  periodo?: PeriodoBI
): Promise<KpisCorretor> {
  const p = periodo || defaultPeriodo()

  const corretor = await db.corretor.findUnique({
    where: { id: corretorId },
    select: { id: true, nome: true, workspaceId: true, userId: true },
  })
  if (!corretor) {
    throw new Error('Corretor não encontrado')
  }

  const [contratos, comissoes, propostasUser] = await Promise.all([
    db.contrato.findMany({
      where: {
        corretorId,
        criadoEm: { gte: p.inicio, lte: p.fim },
      },
      select: {
        id: true,
        criadoEm: true,
        proposta: { select: { valorTotal: true, criadaEm: true, enviadaEm: true } },
      },
    }),
    db.comissaoApurada.aggregate({
      where: {
        corretorId,
        status: { not: 'cancelada' },
        createdAt: { gte: p.inicio, lte: p.fim },
      },
      _sum: { valorCorretor: true },
    }),
    // Hit rate: propostas enviadas vs aceitas — usa userId do corretor como proxy
    // (propostas não têm corretorId direto; aproximamos pelas propostas que viraram contrato do corretor)
    Promise.resolve(null),
  ])

  const contratosFechados = contratos.length
  const valorTotal = contratos.reduce(
    (s, c) => s + Number(c.proposta?.valorTotal || 0),
    0
  )
  const comissaoAcumulada = Number(comissoes._sum.valorCorretor || 0)

  // Tempo médio fechamento (dias): contrato.criadoEm - proposta.criadaEm
  let totalDias = 0
  let nDias = 0
  for (const c of contratos) {
    if (c.proposta?.criadaEm) {
      const ms = c.criadoEm.getTime() - c.proposta.criadaEm.getTime()
      if (ms > 0) {
        totalDias += ms / (1000 * 60 * 60 * 24)
        nDias++
      }
    }
  }
  const tempoMedioFechamento = nDias > 0 ? totalDias / nDias : 0

  // Hit rate aproximado: contratos / propostas enviadas no workspace pelo userId
  let propostasEnviadas = 0
  let propostasAceitas = 0
  // Sem corretorId em Proposta — usamos contratos.length como aceitas; enviadas = todas as propostas do workspace
  // criadas no período pelo user (ofertas->propostas). Heurística mínima.
  propostasAceitas = contratosFechados
  if (corretor.userId) {
    propostasEnviadas = await db.proposta.count({
      where: {
        workspaceId: corretor.workspaceId,
        status: { in: ['enviada', 'aceita', 'recusada'] },
        criadaEm: { gte: p.inicio, lte: p.fim },
        ofertaOrigem: { proprietarioId: corretor.userId },
      },
    })
  }
  if (propostasEnviadas < propostasAceitas) propostasEnviadas = propostasAceitas
  const hitRate = propostasEnviadas > 0
    ? (propostasAceitas / propostasEnviadas) * 100
    : 0

  // Posição no ranking
  const ranking = await rankingCorretores(corretor.workspaceId, p, 999)
  const idx = ranking.findIndex((r) => r.corretorId === corretorId)
  const rankingPosicao = idx >= 0 ? idx + 1 : null

  return {
    corretorId,
    nome: corretor.nome,
    contratosFechados,
    valorTotal: Math.round(valorTotal * 100) / 100,
    propostasEnviadas,
    propostasAceitas,
    hitRate: Math.round(hitRate * 100) / 100,
    tempoMedioFechamento: Math.round(tempoMedioFechamento * 10) / 10,
    comissaoAcumulada: Math.round(comissaoAcumulada * 100) / 100,
    rankingPosicao,
    periodo: { inicio: p.inicio.toISOString(), fim: p.fim.toISOString() },
  }
}

export interface RankingCorretorItem {
  corretorId: string
  nome: string
  contratosFechados: number
  valorTotal: number
  comissaoAcumulada: number
}

export async function rankingCorretores(
  workspaceId: string,
  periodo?: PeriodoBI,
  top = 10
): Promise<RankingCorretorItem[]> {
  const p = periodo || defaultPeriodo()

  const corretores = await db.corretor.findMany({
    where: { workspaceId, ativo: true },
    select: { id: true, nome: true },
  })

  // Buscar contratos + comissões agrupados
  const [contratosAgg, comissoesAgg] = await Promise.all([
    db.contrato.groupBy({
      by: ['corretorId'],
      where: {
        workspaceId,
        corretorId: { not: null },
        criadoEm: { gte: p.inicio, lte: p.fim },
      },
      _count: { _all: true },
    }),
    db.comissaoApurada.groupBy({
      by: ['corretorId'],
      where: {
        workspaceId,
        corretorId: { not: null },
        status: { not: 'cancelada' },
        createdAt: { gte: p.inicio, lte: p.fim },
      },
      _sum: { valorCorretor: true, valorContrato: true },
    }),
  ])

  const contratosMap = new Map<string, number>()
  for (const c of contratosAgg) {
    if (c.corretorId) contratosMap.set(c.corretorId, c._count._all)
  }
  const comissaoMap = new Map<string, { valor: number; contrato: number }>()
  for (const c of comissoesAgg) {
    if (c.corretorId) {
      comissaoMap.set(c.corretorId, {
        valor: Number(c._sum.valorCorretor || 0),
        contrato: Number(c._sum.valorContrato || 0),
      })
    }
  }

  const items: RankingCorretorItem[] = corretores
    .map((c) => {
      const com = comissaoMap.get(c.id)
      return {
        corretorId: c.id,
        nome: c.nome,
        contratosFechados: contratosMap.get(c.id) || 0,
        valorTotal: Math.round((com?.contrato || 0) * 100) / 100,
        comissaoAcumulada: Math.round((com?.valor || 0) * 100) / 100,
      }
    })
    .sort((a, b) => b.comissaoAcumulada - a.comissaoAcumulada || b.contratosFechados - a.contratosFechados)
    .slice(0, top)

  return items
}
