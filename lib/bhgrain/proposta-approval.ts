/**
 * BH Grain — Gate de aprovação humana para Propostas.
 *
 * Decide se uma Proposta exige aprovação antes do envio com base em:
 *  1. CommercialRule.type='aprovacao_valor' (threshold = R$)
 *  2. CommercialRule.type='aprovacao_margem' (threshold = % mínima; abaixo exige)
 *  3. Proposta criada por IA (status='rascunho_ia') — sempre exige
 *
 * Persiste em Aprovacao + AprovacaoWorkflow. NUNCA envia automaticamente.
 */

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export interface AvaliacaoAprovacao {
  precisa: boolean
  motivos: string[]
  regrasAplicadas: { id: string; name: string; type: string }[]
  workflowSugerido?: { etapas: { ordem: number; role: string; nome: string }[]; slaHoras: number }
}

const DEFAULT_WORKFLOW = {
  etapas: [
    { ordem: 1, role: 'gestor', nome: 'Aprovação do gestor comercial' },
  ],
  slaHoras: 48,
}

const DOUBLE_APPROVAL_WORKFLOW = {
  etapas: [
    { ordem: 1, role: 'gestor', nome: 'Aprovação do gestor' },
    { ordem: 2, role: 'admin', nome: 'Aprovação do administrador' },
  ],
  slaHoras: 24,
}

export async function avaliarAprovacao(propostaId: string, workspaceId: string): Promise<AvaliacaoAprovacao> {
  const [proposta, regras] = await Promise.all([
    db.proposta.findFirst({
      where: { id: propostaId, workspaceId },
      select: {
        id: true,
        status: true,
        valorTotal: true,
        margemPercent: true,
        graos: true,
      },
    }),
    db.commercialRule.findMany({
      where: {
        workspaceId,
        active: true,
        OR: [
          { type: 'aprovacao_valor', action: { in: ['aprovar', 'exigir aprovacao', 'aprovação'] } },
          { type: 'aprovacao_margem', action: { in: ['aprovar', 'exigir aprovacao', 'aprovação'] } },
        ],
      },
    }),
  ])

  if (!proposta) {
    return { precisa: false, motivos: [], regrasAplicadas: [] }
  }

  const motivos: string[] = []
  const regrasAplicadas: { id: string; name: string; type: string }[] = []
  let alto = false

  // 1. Rascunho IA sempre exige aprovação humana
  if (proposta.status.toLowerCase().startsWith('rascunho_ia') || proposta.status.toLowerCase() === 'rascunho ia') {
    motivos.push('Proposta gerada por IA exige revisão humana antes do envio')
  }

  // 2. CommercialRules
  const valorTotal = Number(proposta.valorTotal)
  const margem = proposta.margemPercent != null ? Number(proposta.margemPercent) : null

  for (const r of regras) {
    const threshold = r.threshold != null ? Number(r.threshold) : null
    if (threshold == null) continue

    const graoCommodity = ((proposta.graos as { commodity?: string } | null)?.commodity ?? '').toLowerCase()
    if (r.commodity && r.commodity.toLowerCase() !== graoCommodity) continue

    if (r.type === 'aprovacao_valor' && valorTotal >= threshold) {
      motivos.push(`Valor R$ ${valorTotal.toLocaleString('pt-BR')} ≥ threshold R$ ${threshold.toLocaleString('pt-BR')}`)
      regrasAplicadas.push({ id: r.id, name: r.name, type: r.type })
      if (valorTotal >= threshold * 2) alto = true
    }
    if (r.type === 'aprovacao_margem' && margem != null && margem < threshold) {
      motivos.push(`Margem ${margem.toFixed(2)}% abaixo do mínimo ${threshold}%`)
      regrasAplicadas.push({ id: r.id, name: r.name, type: r.type })
    }
  }

  const precisa = motivos.length > 0
  return {
    precisa,
    motivos,
    regrasAplicadas,
    workflowSugerido: precisa ? (alto ? DOUBLE_APPROVAL_WORKFLOW : DEFAULT_WORKFLOW) : undefined,
  }
}

/**
 * Cria (ou reutiliza) Aprovacao para a proposta. Idempotente: se já existe
 * aprovação pendente, retorna ela.
 */
export async function abrirAprovacao(params: {
  propostaId: string
  workspaceId: string
  solicitanteId: string
  motivos: string[]
  regrasAplicadasIds: string[]
  workflow: { etapas: { ordem: number; role: string; nome: string }[]; slaHoras: number }
}): Promise<{ aprovacaoId: string; reused: boolean }> {
  // Reuso
  const existing = await db.aprovacao.findFirst({
    where: {
      workspaceId: params.workspaceId,
      entidadeTipo: 'Proposta',
      entidadeId: params.propostaId,
      status: 'pendente',
    },
    select: { id: true },
  })
  if (existing) return { aprovacaoId: existing.id, reused: true }

  // Garante workflow base
  const nomeWorkflow = `BH Grain — Proposta ${params.workflow.etapas.length > 1 ? 'dupla aprovação' : 'aprovação simples'}`
  let workflow = await db.aprovacaoWorkflow.findFirst({
    where: { workspaceId: params.workspaceId, entidade: 'proposta', nome: nomeWorkflow },
  })
  if (!workflow) {
    workflow = await db.aprovacaoWorkflow.create({
      data: {
        workspaceId: params.workspaceId,
        nome: nomeWorkflow,
        entidade: 'proposta',
        condicao: { auto: true } as Prisma.InputJsonValue,
        etapas: params.workflow.etapas as unknown as Prisma.InputJsonValue,
        slaHoras: params.workflow.slaHoras,
        ativo: true,
      },
    })
  }

  const prazo = new Date(Date.now() + params.workflow.slaHoras * 3600 * 1000)

  const aprov = await db.aprovacao.create({
    data: {
      workspaceId: params.workspaceId,
      workflowId: workflow.id,
      entidadeTipo: 'Proposta',
      entidadeId: params.propostaId,
      snapshot: {
        motivos: params.motivos,
        regrasAplicadasIds: params.regrasAplicadasIds,
        criadoEm: new Date().toISOString(),
      } as Prisma.InputJsonValue,
      etapaAtual: 1,
      totalEtapas: params.workflow.etapas.length,
      status: 'pendente',
      solicitanteId: params.solicitanteId,
      prazoEtapaAtual: prazo,
      observacoes: params.motivos.join(' · '),
    },
    select: { id: true },
  })

  await db.auditLog.create({
    data: {
      userId: params.solicitanteId,
      acao: 'Aprovação aberta para proposta',
      entidade: 'Aprovacao',
      entidadeId: aprov.id,
      workspaceId: params.workspaceId,
      mudancas: {
        propostaId: params.propostaId,
        motivos: params.motivos,
        regrasAplicadasIds: params.regrasAplicadasIds,
      },
    },
  })

  return { aprovacaoId: aprov.id, reused: false }
}

export async function decidirAprovacao(params: {
  aprovacaoId: string
  workspaceId: string
  aprovadorId: string
  decisao: 'aprovado' | 'rejeitado'
  motivo?: string
}): Promise<{ status: string; etapaAtual: number; totalEtapas: number }> {
  const aprov = await db.aprovacao.findFirst({
    where: { id: params.aprovacaoId, workspaceId: params.workspaceId, status: 'pendente' },
  })
  if (!aprov) throw new Error('Aprovação não encontrada ou já decidida')

  await db.aprovacaoDecisao.create({
    data: {
      aprovacaoId: aprov.id,
      etapa: aprov.etapaAtual,
      aprovadorId: params.aprovadorId,
      decisao: params.decisao,
      motivo: params.motivo,
    },
  })

  if (params.decisao === 'rejeitado') {
    await db.aprovacao.update({ where: { id: aprov.id }, data: { status: 'rejeitada' } })
    await db.auditLog.create({
      data: {
        userId: params.aprovadorId,
        acao: 'Aprovação rejeitada',
        entidade: 'Aprovacao',
        entidadeId: aprov.id,
        workspaceId: params.workspaceId,
        mudancas: { etapa: aprov.etapaAtual, motivo: params.motivo },
      },
    })
    return { status: 'rejeitada', etapaAtual: aprov.etapaAtual, totalEtapas: aprov.totalEtapas }
  }

  // Aprovado: avança etapa ou conclui
  const novaEtapa = aprov.etapaAtual + 1
  if (novaEtapa > aprov.totalEtapas) {
    await db.aprovacao.update({ where: { id: aprov.id }, data: { status: 'aprovada' } })
    // Promove proposta para 'pronta_para_enviar'
    await db.proposta.update({
      where: { id: aprov.entidadeId },
      data: { status: 'pronta_para_enviar' },
    })
    await db.auditLog.create({
      data: {
        userId: params.aprovadorId,
        acao: 'Aprovação concluída · proposta pronta para envio',
        entidade: 'Aprovacao',
        entidadeId: aprov.id,
        workspaceId: params.workspaceId,
        mudancas: { propostaId: aprov.entidadeId },
      },
    })
    return { status: 'aprovada', etapaAtual: aprov.totalEtapas, totalEtapas: aprov.totalEtapas }
  } else {
    const novoPrazo = new Date(Date.now() + 48 * 3600 * 1000) // resetar SLA por etapa
    await db.aprovacao.update({
      where: { id: aprov.id },
      data: { etapaAtual: novaEtapa, prazoEtapaAtual: novoPrazo },
    })
    return { status: 'pendente', etapaAtual: novaEtapa, totalEtapas: aprov.totalEtapas }
  }
}
