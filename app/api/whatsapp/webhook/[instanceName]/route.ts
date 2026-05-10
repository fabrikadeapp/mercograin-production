/**
 * POST /api/whatsapp/webhook/[instanceName]
 *
 * Receiver dos webhooks Evolution API por instância.
 * - Multi-tenancy: instance lookup → workspaceId
 * - Auth: shared secret no header `apikey` ou `x-webhook-secret`
 * - Idempotência: WhatsAppMessage.@@unique([workspaceId, messageId])
 * - SEMPRE retorna 200 (com OK ou ack=false). Erros internos só são logados;
 *   retornar 5xx faria Evolution entrar em loop de retry exponencial.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { captureError, captureMessage } from '@/lib/observability/capture'
import {
  handleEvolutionEvent,
  type EvolutionWebhookPayload,
} from '@/lib/whatsapp/webhook-handler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(
  req: Request,
  { params }: { params: { instanceName: string } }
) {
  const { instanceName } = params

  // 1. Lookup da instância
  const instance = await db.whatsAppInstance.findUnique({
    where: { instanceName },
    select: { id: true, workspaceId: true, webhookSecret: true },
  })
  if (!instance) {
    captureMessage('whatsapp webhook unknown instance', 'warning', {
      instanceName,
    })
    // 200 mesmo assim — não queremos retry pra instância morta
    return NextResponse.json({ ok: false, reason: 'unknown_instance' })
  }

  // 2. Validar shared secret (se configurado)
  if (instance.webhookSecret) {
    const auth =
      req.headers.get('apikey') ||
      req.headers.get('x-webhook-secret') ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
      null
    if (auth !== instance.webhookSecret) {
      captureMessage('whatsapp webhook auth failed', 'warning', { instanceName })
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  // 3. Parse payload
  let payload: EvolutionWebhookPayload
  try {
    payload = (await req.json()) as EvolutionWebhookPayload
  } catch {
    return NextResponse.json({ error: 'bad payload' }, { status: 400 })
  }

  // 4. Roteamento
  try {
    await handleEvolutionEvent(
      { id: instance.id, workspaceId: instance.workspaceId, instanceName },
      payload
    )
  } catch (e) {
    captureError(e, {
      event: payload?.event,
      instanceName,
      where: 'whatsapp.webhook',
    })
    // CRÍTICO: NUNCA 500 — Evolution faria retry agressivo. Sempre 200.
    return NextResponse.json({ ok: false, error: 'internal' })
  }

  return NextResponse.json({ ok: true })
}
