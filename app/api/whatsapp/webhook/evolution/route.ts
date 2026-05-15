/**
 * POST /api/whatsapp/webhook/evolution
 *
 * Webhook GLOBAL do Evolution API central (1 servidor compartilhado por
 * todos os workspaces). Evolution dispara TODOS os eventos aqui; nós roteamos
 * para o workspace certo via instanceName no payload.
 *
 * Configurado em infrastructure/evolution-api/README.md:
 *   WEBHOOK_GLOBAL_URL=https://www.profitsync.ia.br/api/whatsapp/webhook/evolution
 *
 * Para webhook por-instância (BYO), continua usando /api/whatsapp/webhook/[instanceName].
 *
 * Auth: shared secret no header apikey (igual ao AUTHENTICATION_API_KEY do
 * servidor Evolution). SEMPRE retorna 200 — Evolution faz retry exponencial
 * em qualquer 5xx, pode travar a fila.
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { captureError, captureMessage } from '@/lib/observability/capture'
import {
  handleEvolutionEvent,
  type EvolutionWebhookPayload,
} from '@/lib/whatsapp/webhook-handler'
import { updateCredential, type WhatsappConfig } from '@/lib/bhgrain/credentials'
import { extractPhoneFromJid } from '@/lib/whatsapp/evolution-central'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function isAuthorized(req: Request): boolean {
  const expected = process.env.EVOLUTION_CENTRAL_API_KEY
  if (!expected) return false
  const got = req.headers.get('apikey') ?? req.headers.get('x-webhook-secret')
  return !!got && got === expected
}

interface WebhookBody {
  event?: string
  instance?: string
  data?: unknown
  date_time?: string
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    captureMessage('whatsapp webhook unauthorized', 'warning')
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 200 })
  }

  let body: WebhookBody
  try {
    body = (await req.json()) as WebhookBody
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 200 })
  }

  const instanceName = body.instance
  if (!instanceName) {
    return NextResponse.json({ ok: false, reason: 'missing_instance' }, { status: 200 })
  }

  // Resolver workspaceId pela credencial
  const cred = await db.integrationCredential.findFirst({
    where: { channel: 'whatsapp', identifier: instanceName },
    select: { id: true, workspaceId: true, config: true, enabled: true },
  })

  if (!cred) {
    // Pode ser instância criada manualmente fora do BH Grain — só loga
    captureMessage('whatsapp webhook unknown instance', 'warning', { instanceName })
    return NextResponse.json({ ok: false, reason: 'unknown_instance' }, { status: 200 })
  }

  // Conexão atualizada: persiste phoneNumber + enabled
  const evt = (body.event ?? '').toLowerCase()
  if (evt === 'connection.update' || evt === 'connection_update') {
    try {
      const data = (body.data ?? {}) as {
        state?: string
        wuid?: string
        instance?: { wuid?: string; profileName?: string }
      }
      const ownerJid = data.wuid ?? data.instance?.wuid ?? null
      const phone = extractPhoneFromJid(ownerJid)
      const cfg = cred.config as unknown as WhatsappConfig
      if (data.state === 'open' && (phone || !cred.enabled)) {
        await updateCredential<WhatsappConfig, never>({
          workspaceId: cred.workspaceId,
          id: cred.id,
          channel: 'whatsapp',
          config: { ...cfg, phoneNumber: phone ?? cfg.phoneNumber ?? null },
          enabled: true,
          displayName: data.instance?.profileName ?? undefined,
        })
      } else if (data.state === 'close') {
        await updateCredential<WhatsappConfig, never>({
          workspaceId: cred.workspaceId,
          id: cred.id,
          channel: 'whatsapp',
          enabled: false,
        })
      }
    } catch (err) {
      captureError(err, { where: 'whatsapp-webhook-connection-update', instanceName })
    }
  }

  // Para mensagens / QR / outros eventos, encaminhar ao handler existente.
  // Ele precisa de um InstanceCtx no formato do schema antigo (WhatsAppInstance).
  // Como agora o cadastro vive em IntegrationCredential, vamos garantir
  // que existe uma row em WhatsAppInstance espelhando — single source of truth
  // para o handler legacy continuar funcionando.
  let waInstance = await db.whatsAppInstance.findUnique({
    where: { instanceName },
    select: { id: true, workspaceId: true },
  })
  if (!waInstance) {
    // Auto-cria espelho da credencial
    try {
      waInstance = await db.whatsAppInstance.create({
        data: {
          workspaceId: cred.workspaceId,
          instanceName,
          status: 'connecting',
          webhookSecret: process.env.EVOLUTION_CENTRAL_API_KEY ?? '',
        },
        select: { id: true, workspaceId: true },
      })
    } catch (err) {
      // Pode falhar pelo @@unique(workspaceId) se já existe outra instance.
      // Nesse caso pega a existente.
      waInstance = await db.whatsAppInstance.findUnique({
        where: { workspaceId: cred.workspaceId },
        select: { id: true, workspaceId: true },
      })
      if (!waInstance) {
        captureError(err, { where: 'whatsapp-webhook-create-mirror', instanceName })
        return NextResponse.json({ ok: false, reason: 'mirror_failed' }, { status: 200 })
      }
    }
  }

  try {
    await handleEvolutionEvent(
      { id: waInstance.id, workspaceId: waInstance.workspaceId, instanceName },
      body as EvolutionWebhookPayload
    )
  } catch (err) {
    captureError(err, { where: 'whatsapp-webhook-handler', instanceName, event: body.event })
  }

  return NextResponse.json({ ok: true })
}
