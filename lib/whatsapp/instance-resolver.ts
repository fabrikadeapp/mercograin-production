/**
 * Helper de resolução de instância WhatsApp Evolution por workspace.
 *
 * Cada workspace tem 1 instância Evolution dedicada. Este módulo é o ponto
 * único de criação/lookup, garantindo idempotência tanto no DB quanto na
 * Evolution API.
 *
 * Webhook: ao criar (e ao detectar instância sem webhookSecret salvo),
 * configuramos o webhook receiver da app via setWebhook.
 */
import crypto from 'crypto'
import { db } from '@/lib/db'
import {
  createInstance as evoCreateInstance,
  setWebhook as evoSetWebhook,
} from './evolution'
import { captureError } from '@/lib/observability/capture'

/** Gera instanceName determinístico baseado no workspaceId. */
function buildInstanceName(workspaceId: string): string {
  const slug = workspaceId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)
  return `phb-ws_${slug}`
}

/** Base URL pública da app — precisa ser https acessível pelo Evolution. */
function getAppBaseUrl(): string | null {
  const url =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    null
  return url ? url.replace(/\/+$/, '') : null
}

export function buildWebhookUrl(instanceName: string): string | null {
  const base = getAppBaseUrl()
  if (!base) return null
  return `${base}/api/whatsapp/webhook/${encodeURIComponent(instanceName)}`
}

/**
 * Retorna a instância do workspace, criando-a (DB + Evolution) se não existir.
 * Idempotente — chamar várias vezes é seguro.
 *
 * Para instâncias já existentes que ainda não têm webhook configurado
 * (webhookSecret null OU criada antes do receiver), reaplica o webhook.
 */
export async function ensureInstance(workspaceId: string) {
  const existing = await db.whatsAppInstance.findUnique({
    where: { workspaceId },
  })
  if (existing) {
    // Retroativo: se a instância antiga não tem webhookSecret, gerar e configurar
    if (!existing.webhookSecret) {
      const secret = crypto.randomBytes(32).toString('hex')
      const webhookUrl = buildWebhookUrl(existing.instanceName)
      if (webhookUrl) {
        try {
          await evoSetWebhook(existing.instanceName, webhookUrl, secret)
          const updated = await db.whatsAppInstance.update({
            where: { id: existing.id },
            data: { webhookSecret: secret },
          })
          return updated
        } catch (e) {
          captureError(e, {
            where: 'ensureInstance.setWebhook',
            instanceName: existing.instanceName,
          })
          // Não bloquear retorno — webhook pode ser reconfigurado depois
        }
      }
    }
    return existing
  }

  const instanceName = buildInstanceName(workspaceId)
  const webhookSecret = crypto.randomBytes(32).toString('hex')
  const webhookUrl = buildWebhookUrl(instanceName)

  // Cria no Evolution (idempotente — 409/already exists tolerados)
  try {
    await evoCreateInstance(instanceName, {
      webhookSecret,
      webhookUrl: webhookUrl ?? undefined,
    })
  } catch (e: any) {
    const msg = String(e?.message || '').toLowerCase()
    if (!(msg.includes('already') || msg.includes('exists') || msg.includes('409'))) {
      throw e
    }
    // Já existia no Evolution mas não no nosso DB — força set webhook
    if (webhookUrl) {
      try {
        await evoSetWebhook(instanceName, webhookUrl, webhookSecret)
      } catch (err) {
        captureError(err, {
          where: 'ensureInstance.setWebhook.afterExists',
          instanceName,
        })
      }
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
