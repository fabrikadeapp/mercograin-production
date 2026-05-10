/**
 * Helper de resolução de instância WhatsApp Evolution por workspace.
 *
 * Cada workspace tem 1 instância Evolution dedicada. Este módulo é o ponto
 * único de criação/lookup, garantindo idempotência tanto no DB quanto na
 * Evolution API.
 */
import crypto from 'crypto'
import { db } from '@/lib/db'
import { createInstance as evoCreateInstance } from './evolution'

/** Gera instanceName determinístico baseado no workspaceId. */
function buildInstanceName(workspaceId: string): string {
  const slug = workspaceId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)
  return `phb-ws_${slug}`
}

/**
 * Retorna a instância do workspace, criando-a (DB + Evolution) se não existir.
 * Idempotente — chamar várias vezes é seguro.
 */
export async function ensureInstance(workspaceId: string) {
  const existing = await db.whatsAppInstance.findUnique({
    where: { workspaceId },
  })
  if (existing) return existing

  const instanceName = buildInstanceName(workspaceId)
  const webhookSecret = crypto.randomBytes(32).toString('hex')

  // Cria no Evolution (idempotente — 409/already exists tolerados em createInstance)
  try {
    await evoCreateInstance(instanceName, { webhookSecret })
  } catch (e: any) {
    const msg = String(e?.message || '').toLowerCase()
    if (!(msg.includes('already') || msg.includes('exists') || msg.includes('409'))) {
      throw e
    }
  }

  // Insert no DB. Em race conditions, capturar P2002 e retornar o existente.
  try {
    return await db.whatsAppInstance.create({
      data: {
        workspaceId,
        instanceName,
        webhookSecret,
        status: 'disconnected',
      },
    })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      const row = await db.whatsAppInstance.findUnique({
        where: { workspaceId },
      })
      if (row) return row
    }
    throw e
  }
}

export async function getInstanceForWorkspace(workspaceId: string) {
  return db.whatsAppInstance.findUnique({ where: { workspaceId } })
}
