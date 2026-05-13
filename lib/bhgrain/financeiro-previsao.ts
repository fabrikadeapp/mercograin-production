/**
 * BH Grain — Materialização de previsão de receita em MovimentoFinanceiro.
 *
 * Para cada Proposta aberta (enviada/em_negociacao), cria/atualiza um
 * MovimentoFinanceiro tipo='receita' natureza='outros' com:
 *   - data = previsão de caixa (default: enviadaEm + 14 dias)
 *   - valor = valorTotal × probabilidade ponderada
 *   - descricao = 'Previsão BH Grain · {numero}'
 *
 * Idempotente: usa descricao prefix + propostaId como chave lógica.
 * Quando proposta é fechada ('sucesso'), o movimento previsto vira realizado.
 * Quando recusada, o movimento previsto é removido.
 */

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { probabilidade } from './previsao'

const DESC_PREFIX = 'Previsão BH Grain'
const STATUS_ABERTOS = ['enviada', 'em_negociacao', 'pronta_para_enviar']
const STATUS_FECHADOS = ['sucesso', 'aceita', 'concluido', 'faturado']

export interface SyncStats {
  workspaceId: string
  criados: number
  atualizados: number
  removidos: number
  realizados: number
}

export async function syncPrevisaoFinanceira(workspaceId: string): Promise<SyncStats> {
  let criados = 0
  let atualizados = 0
  let removidos = 0
  let realizados = 0

  // 1. Propostas em aberto → upsert movimento previsto
  const abertas = await db.proposta.findMany({
    where: { workspaceId, status: { in: STATUS_ABERTOS } },
    select: {
      id: true,
      numero: true,
      valorTotal: true,
      status: true,
      enviadaEm: true,
      scoreInterno: true,
      cliente: { select: { nome: true } },
    },
    take: 1000,
  })

  for (const p of abertas) {
    const prob = probabilidade({
      valorTotal: Number(p.valorTotal),
      status: p.status,
      score: p.scoreInterno,
    })
    const valorPonderado = Math.round(Number(p.valorTotal) * prob * 100) / 100
    if (valorPonderado <= 0) continue

    const dataPrevisao = p.enviadaEm
      ? new Date(p.enviadaEm.getTime() + 14 * 86400 * 1000)
      : new Date(Date.now() + 30 * 86400 * 1000)

    const desc = `${DESC_PREFIX} · ${p.numero} · ${p.cliente.nome}`
    // Procura existente
    const existing = await db.movimentoFinanceiro.findFirst({
      where: { workspaceId, descricao: desc },
      select: { id: true, valor: true, data: true },
    })
    if (existing) {
      const valorAntigo = Number(existing.valor)
      if (Math.abs(valorAntigo - valorPonderado) > 0.01 || existing.data.getTime() !== dataPrevisao.getTime()) {
        await db.movimentoFinanceiro.update({
          where: { id: existing.id },
          data: { valor: new Prisma.Decimal(valorPonderado), data: dataPrevisao, conciliado: false },
        })
        atualizados++
      }
    } else {
      await db.movimentoFinanceiro.create({
        data: {
          workspaceId,
          data: dataPrevisao,
          tipo: 'receita',
          natureza: 'outros',
          valor: new Prisma.Decimal(valorPonderado),
          descricao: desc,
        },
      })
      criados++
    }
  }

  // 2. Propostas fechadas com sucesso → atualizar movimento para valor cheio + marcar conciliado
  const fechadas = await db.proposta.findMany({
    where: { workspaceId, status: { in: STATUS_FECHADOS } },
    select: { id: true, numero: true, valorTotal: true, atualizadaEm: true, cliente: { select: { nome: true } } },
    take: 1000,
  })
  for (const p of fechadas) {
    const desc = `${DESC_PREFIX} · ${p.numero} · ${p.cliente.nome}`
    const existing = await db.movimentoFinanceiro.findFirst({
      where: { workspaceId, descricao: desc },
      select: { id: true, conciliado: true },
    })
    if (existing && !existing.conciliado) {
      await db.movimentoFinanceiro.update({
        where: { id: existing.id },
        data: {
          valor: new Prisma.Decimal(Number(p.valorTotal)),
          conciliado: true,
          conciliadoEm: new Date(),
        },
      })
      realizados++
    }
  }

  // 3. Propostas recusadas/canceladas → remover movimento previsto não conciliado
  const recusadas = await db.proposta.findMany({
    where: { workspaceId, status: { in: ['recusada', 'cancelada', 'expirada'] } },
    select: { numero: true, cliente: { select: { nome: true } } },
    take: 1000,
  })
  for (const p of recusadas) {
    const desc = `${DESC_PREFIX} · ${p.numero} · ${p.cliente.nome}`
    const del = await db.movimentoFinanceiro.deleteMany({
      where: { workspaceId, descricao: desc, conciliado: false },
    })
    removidos += del.count
  }

  return { workspaceId, criados, atualizados, removidos, realizados }
}

export async function syncPrevisaoTodos(): Promise<SyncStats[]> {
  const workspaces = await db.workspace.findMany({ select: { id: true }, take: 1000 })
  const out: SyncStats[] = []
  for (const w of workspaces) {
    try {
      out.push(await syncPrevisaoFinanceira(w.id))
    } catch {
      // ignora
    }
  }
  return out
}
