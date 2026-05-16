/**
 * BH Grain — Gestão de pausa de integrações por workspace.
 *
 * Permite ao admin pausar temporariamente a ingestão de uma integração
 * (e-mail, WhatsApp, Instagram, etc) sem precisar deletar credencial.
 *
 * Use isIntegrationPaused() antes de processar webhooks/crons. Quando
 * pausedUntil já expirou, automaticamente desfaz a pausa (lazy reset).
 */

import { db } from '@/lib/db'

export type IntegrationKey =
  | 'email'
  | 'whatsapp'
  | 'instagram'
  | 'portal'
  | 'precos'
  | 'ia'
  | 'financeiro'

/** Lista canônica para UI. */
export const KNOWN_INTEGRATIONS: IntegrationKey[] = [
  'email',
  'whatsapp',
  'instagram',
  'portal',
  'precos',
  'ia',
  'financeiro',
]

export interface PauseState {
  paused: boolean
  pausedUntil: string | null
  pausedBy: string | null
  pausedReason: string | null
}

/**
 * Retorna true se a integração está pausada AGORA. Faz lazy-reset:
 * quando pausedUntil já passou, marca paused=false antes de retornar.
 */
export async function isIntegrationPaused(
  workspaceId: string,
  integration: IntegrationKey | string
): Promise<boolean> {
  const row = await db.integrationHealth.findUnique({
    where: { workspaceId_integration: { workspaceId, integration } },
    select: { paused: true, pausedUntil: true, id: true },
  })
  if (!row || !row.paused) return false

  // Pausa expirada → reset automático
  if (row.pausedUntil && row.pausedUntil <= new Date()) {
    await db.integrationHealth.update({
      where: { id: row.id },
      data: { paused: false, pausedUntil: null, pausedBy: null, pausedReason: null },
    })
    return false
  }
  return true
}

/**
 * Liga ou desliga a pausa de uma integração.
 *
 * @param pausedUntil opcional — pausar até essa data. Sem isso = pausa indefinida.
 */
export async function setIntegrationPause(args: {
  workspaceId: string
  integration: IntegrationKey | string
  paused: boolean
  pausedUntil?: Date | null
  pausedBy?: string
  pausedReason?: string | null
}): Promise<PauseState> {
  const data = args.paused
    ? {
        paused: true,
        pausedUntil: args.pausedUntil ?? null,
        pausedBy: args.pausedBy ?? null,
        pausedReason: args.pausedReason ?? null,
      }
    : { paused: false, pausedUntil: null, pausedBy: null, pausedReason: null }

  const row = await db.integrationHealth.upsert({
    where: {
      workspaceId_integration: { workspaceId: args.workspaceId, integration: args.integration },
    },
    create: {
      workspaceId: args.workspaceId,
      integration: args.integration,
      status: 'desconectada', // se ainda não existia health row, começa desconectada
      ...data,
    },
    update: data,
    select: {
      paused: true,
      pausedUntil: true,
      pausedBy: true,
      pausedReason: true,
    },
  })

  return {
    paused: row.paused,
    pausedUntil: row.pausedUntil?.toISOString() ?? null,
    pausedBy: row.pausedBy,
    pausedReason: row.pausedReason,
  }
}
