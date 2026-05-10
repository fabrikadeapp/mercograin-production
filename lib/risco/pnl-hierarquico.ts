/**
 * P&L hierárquico — agregação por mesa, corretor e contrato.
 *
 * Usa MarcacaoMercado mais recente por posição (P&L unrealized) +
 * pnlFinal das posições fechadas para o P&L realizado.
 */

import { db } from '@/lib/db'

export interface Periodo {
  de: Date
  ate: Date
}

export interface PnLAgregado {
  chave: string
  nome: string
  pnlUSD: number
  pnlBRL: number
  qtdPosicoes: number
  qtdAbertas: number
  qtdFechadas: number
}

interface AgregadorState {
  pnlUSD: number
  pnlBRL: number
  nome: string
  qtdPosicoes: number
  qtdAbertas: number
  qtdFechadas: number
}

async function posicoesComPnL(
  workspaceId: string,
  periodo?: Periodo,
): Promise<
  Array<{
    id: string
    mesaId: string | null
    corretorId: string | null
    contratoOrigemId: string | null
    status: string
    pnlUSD: number
    pnlBRL: number
  }>
> {
  const where: any = { workspaceId }
  if (periodo) {
    where.OR = [
      { abertoEm: { gte: periodo.de, lte: periodo.ate } },
      { fechadoEm: { gte: periodo.de, lte: periodo.ate } },
    ]
  }
  const posicoes = await db.posicaoHedge.findMany({
    where,
    select: {
      id: true,
      mesaId: true,
      corretorId: true,
      contratoOrigemId: true,
      status: true,
      pnlFinalUSD: true,
      pnlFinalBRL: true,
      marcacoes: {
        orderBy: { data: 'desc' },
        take: 1,
        select: { pnlUnrealizedUSD: true, pnlUnrealizedBRL: true },
      },
    },
  })
  return posicoes.map((p) => {
    let pnlUSD = 0
    let pnlBRL = 0
    if (p.status === 'fechada' || p.status === 'liquidada') {
      pnlUSD = Number(p.pnlFinalUSD ?? 0)
      pnlBRL = Number(p.pnlFinalBRL ?? 0)
    } else if (p.marcacoes[0]) {
      pnlUSD = Number(p.marcacoes[0].pnlUnrealizedUSD ?? 0)
      pnlBRL = Number(p.marcacoes[0].pnlUnrealizedBRL ?? 0)
    }
    return {
      id: p.id,
      mesaId: p.mesaId,
      corretorId: p.corretorId,
      contratoOrigemId: p.contratoOrigemId,
      status: p.status,
      pnlUSD,
      pnlBRL,
    }
  })
}

export async function calcularPnLPorMesa(
  workspaceId: string,
  periodo?: Periodo,
): Promise<PnLAgregado[]> {
  const posicoes = await posicoesComPnL(workspaceId, periodo)
  const mesas = await db.mesa.findMany({ where: { workspaceId } })
  const nomeMap = new Map(mesas.map((m) => [m.id, m.nome]))

  const map = new Map<string, AgregadorState>()
  for (const p of posicoes) {
    const k = p.mesaId || '_sem_mesa'
    const nome = p.mesaId ? nomeMap.get(p.mesaId) || 'Mesa removida' : 'Sem mesa'
    if (!map.has(k))
      map.set(k, { pnlUSD: 0, pnlBRL: 0, nome, qtdPosicoes: 0, qtdAbertas: 0, qtdFechadas: 0 })
    const v = map.get(k)!
    v.pnlUSD += p.pnlUSD
    v.pnlBRL += p.pnlBRL
    v.qtdPosicoes++
    if (p.status === 'aberta') v.qtdAbertas++
    else v.qtdFechadas++
  }
  return Array.from(map.entries()).map(([chave, v]) => ({ chave, ...v }))
}

export async function calcularPnLPorCorretor(
  workspaceId: string,
  periodo?: Periodo,
): Promise<PnLAgregado[]> {
  const posicoes = await posicoesComPnL(workspaceId, periodo)
  const corretores = await db.corretor.findMany({ where: { workspaceId } })
  const nomeMap = new Map(corretores.map((c) => [c.id, c.nome]))

  const map = new Map<string, AgregadorState>()
  for (const p of posicoes) {
    const k = p.corretorId || '_sem_corretor'
    const nome = p.corretorId
      ? nomeMap.get(p.corretorId) || 'Corretor removido'
      : 'Sem corretor'
    if (!map.has(k))
      map.set(k, { pnlUSD: 0, pnlBRL: 0, nome, qtdPosicoes: 0, qtdAbertas: 0, qtdFechadas: 0 })
    const v = map.get(k)!
    v.pnlUSD += p.pnlUSD
    v.pnlBRL += p.pnlBRL
    v.qtdPosicoes++
    if (p.status === 'aberta') v.qtdAbertas++
    else v.qtdFechadas++
  }
  return Array.from(map.entries()).map(([chave, v]) => ({ chave, ...v }))
}

export async function calcularPnLPorContrato(
  workspaceId: string,
  periodo?: Periodo,
): Promise<PnLAgregado[]> {
  const posicoes = await posicoesComPnL(workspaceId, periodo)
  const contratoIds = Array.from(
    new Set(posicoes.map((p) => p.contratoOrigemId).filter(Boolean) as string[]),
  )
  const contratos = await db.contrato.findMany({
    where: { id: { in: contratoIds } },
    select: { id: true, numero: true },
  })
  const nomeMap = new Map(contratos.map((c) => [c.id, c.numero]))

  const map = new Map<string, AgregadorState>()
  for (const p of posicoes) {
    const k = p.contratoOrigemId || '_sem_contrato'
    const nome = p.contratoOrigemId
      ? nomeMap.get(p.contratoOrigemId) || 'Contrato removido'
      : 'Sem contrato'
    if (!map.has(k))
      map.set(k, { pnlUSD: 0, pnlBRL: 0, nome, qtdPosicoes: 0, qtdAbertas: 0, qtdFechadas: 0 })
    const v = map.get(k)!
    v.pnlUSD += p.pnlUSD
    v.pnlBRL += p.pnlBRL
    v.qtdPosicoes++
    if (p.status === 'aberta') v.qtdAbertas++
    else v.qtdFechadas++
  }
  return Array.from(map.entries()).map(([chave, v]) => ({ chave, ...v }))
}

export interface RankingCorretor extends PnLAgregado {
  rank: number
  comissaoUSD: number
  comissaoBRL: number
}

export async function calcularRankingCorretores(
  workspaceId: string,
  periodo?: Periodo,
): Promise<RankingCorretor[]> {
  const pnl = await calcularPnLPorCorretor(workspaceId, periodo)
  const corretores = await db.corretor.findMany({ where: { workspaceId } })
  const comMap = new Map(corretores.map((c) => [c.id, c.comissaoPct]))

  return pnl
    .filter((p) => p.chave !== '_sem_corretor')
    .sort((a, b) => b.pnlBRL - a.pnlBRL)
    .map((p, idx) => {
      const pct = (comMap.get(p.chave) ?? 0.5) / 100
      return {
        ...p,
        rank: idx + 1,
        comissaoUSD: Math.max(0, p.pnlUSD) * pct,
        comissaoBRL: Math.max(0, p.pnlBRL) * pct,
      }
    })
}
