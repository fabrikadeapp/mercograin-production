/**
 * BH Grain — Coletor de health checks por integração × workspace.
 *
 * Cada integração tem uma sonda específica. Cron chama collectHealthAll().
 */

import { db } from '@/lib/db'

export type Integration = 'whatsapp' | 'email' | 'instagram' | 'portal' | 'precos' | 'ia' | 'financeiro'
export type IntegrationStatus = 'online' | 'instavel' | 'atraso' | 'erro' | 'desconectada'

interface HealthSnapshot {
  status: IntegrationStatus
  lastSuccessAt?: Date | null
  lastFailureAt?: Date | null
  responseTimeMs?: number | null
  pendingEvents?: number
  processedEvents?: number
  lastErrorMessage?: string | null
}

async function probeWhatsApp(workspaceId: string): Promise<HealthSnapshot> {
  const inst = await db.whatsAppInstance.findFirst({ where: { workspaceId } })
  if (!inst) return { status: 'desconectada' }
  // Considera 'connected' como online. Outros valores → erro/atraso.
  const st = (inst.status ?? '').toLowerCase()
  const recente = await db.whatsAppMessage.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  const totalProcessadas = await db.whatsAppMessage.count({ where: { workspaceId } })
  return {
    status: st === 'connected' ? 'online' : st === 'connecting' ? 'instavel' : 'desconectada',
    lastSuccessAt: recente?.createdAt ?? null,
    processedEvents: totalProcessadas,
  }
}

async function probePrecos(workspaceId: string): Promise<HealthSnapshot> {
  // Sonda: cotação mais recente. Se < 60min => online, < 4h => atraso, > 4h => erro.
  const recente = await db.cotacao.findFirst({ orderBy: { data: 'desc' }, select: { data: true } })
  if (!recente) return { status: 'desconectada' }
  const idadeMin = (Date.now() - recente.data.getTime()) / 60000
  let status: IntegrationStatus = 'online'
  if (idadeMin > 60 * 24) status = 'desconectada'
  else if (idadeMin > 60 * 4) status = 'erro'
  else if (idadeMin > 60) status = 'atraso'
  return { status, lastSuccessAt: recente.data, responseTimeMs: null }
}

async function probePortal(workspaceId: string): Promise<HealthSnapshot> {
  const m = await db.mensagemProdutor.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  if (!m) return { status: 'desconectada' }
  const idadeH = (Date.now() - m.createdAt.getTime()) / 3600000
  return {
    status: idadeH < 24 * 7 ? 'online' : 'atraso',
    lastSuccessAt: m.createdAt,
  }
}

async function probeIA(workspaceId: string): Promise<HealthSnapshot> {
  // Sonda: ConversationMessage com aiExtraction nas últimas 24h.
  const since = new Date(Date.now() - 24 * 3600 * 1000)
  const proc = await db.conversationMessage.count({
    where: { workspaceId, occurredAt: { gte: since }, aiExtraction: { not: undefined } },
  })
  return {
    status: process.env.OPENAI_API_KEY || proc > 0 ? 'online' : 'desconectada',
    processedEvents: proc,
  }
}

async function probeFinanceiro(workspaceId: string): Promise<HealthSnapshot> {
  // Sonda: existe alguma movimentação financeira nos últimos 90d? Se sim, online.
  const since = new Date(Date.now() - 90 * 86400 * 1000)
  const m = await db.movimentoFinanceiro.findFirst({
    where: { workspaceId, createdAt: { gte: since } },
    select: { createdAt: true },
  }).catch(() => null)
  return {
    status: m ? 'online' : 'desconectada',
    lastSuccessAt: m?.createdAt ?? null,
  }
}

async function probeEmail(workspaceId: string): Promise<HealthSnapshot> {
  // Sonda: Conversation channel=email com atividade. Sem ingestão real ainda.
  const c = await db.conversation.findFirst({
    where: { workspaceId, channel: 'email' },
    orderBy: { lastMessageAt: 'desc' },
    select: { lastMessageAt: true },
  })
  return c
    ? { status: 'online', lastSuccessAt: c.lastMessageAt }
    : { status: 'desconectada' }
}

async function probeInstagram(workspaceId: string): Promise<HealthSnapshot> {
  const c = await db.conversation.findFirst({
    where: { workspaceId, channel: 'instagram' },
    orderBy: { lastMessageAt: 'desc' },
    select: { lastMessageAt: true },
  })
  return c
    ? { status: 'online', lastSuccessAt: c.lastMessageAt }
    : { status: 'desconectada' }
}

const PROBES: Record<Integration, (wsId: string) => Promise<HealthSnapshot>> = {
  whatsapp: probeWhatsApp,
  precos: probePrecos,
  portal: probePortal,
  ia: probeIA,
  financeiro: probeFinanceiro,
  email: probeEmail,
  instagram: probeInstagram,
}

export async function collectHealthWorkspace(workspaceId: string): Promise<number> {
  let count = 0
  const integrations: Integration[] = ['whatsapp', 'email', 'instagram', 'portal', 'precos', 'ia', 'financeiro']
  for (const integration of integrations) {
    const snap: HealthSnapshot = await PROBES[integration](workspaceId).catch((e: unknown) => ({
      status: 'erro' as IntegrationStatus,
      lastErrorMessage: e instanceof Error ? e.message.slice(0, 500) : 'erro',
    }))
    await db.integrationHealth.upsert({
      where: { workspaceId_integration: { workspaceId, integration } },
      create: {
        workspaceId,
        integration,
        status: snap.status,
        lastSuccessAt: snap.lastSuccessAt ?? null,
        lastFailureAt: snap.lastFailureAt ?? (snap.status === 'erro' || snap.status === 'desconectada' ? new Date() : null),
        responseTimeMs: snap.responseTimeMs ?? null,
        pendingEvents: snap.pendingEvents ?? 0,
        processedEvents: snap.processedEvents ?? 0,
        lastErrorMessage: snap.lastErrorMessage ?? null,
      },
      update: {
        status: snap.status,
        lastSuccessAt: snap.lastSuccessAt ?? undefined,
        lastFailureAt: snap.status === 'erro' || snap.status === 'desconectada' ? new Date() : undefined,
        responseTimeMs: snap.responseTimeMs ?? undefined,
        pendingEvents: snap.pendingEvents ?? 0,
        processedEvents: snap.processedEvents ?? 0,
        lastErrorMessage: snap.lastErrorMessage ?? null,
      },
    })
    count++
  }
  return count
}

export async function collectHealthAll(): Promise<{ workspaces: number; checks: number }> {
  const workspaces = await db.workspace.findMany({ select: { id: true }, take: 1000 })
  let checks = 0
  for (const w of workspaces) {
    try {
      checks += await collectHealthWorkspace(w.id)
    } catch {
      // segue
    }
  }
  return { workspaces: workspaces.length, checks }
}
