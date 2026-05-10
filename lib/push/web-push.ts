/**
 * Web Push (VAPID) — gratuito, padrão W3C.
 *
 * Setup (1x):
 *   npx web-push generate-vapid-keys
 *   → salva em env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 *
 * Graceful degrade: sem chaves configuradas, send retorna { ok: false } sem throw.
 */
import webpush from 'web-push'

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@profitsync.ia.br'

let configured = false
function ensureConfigured(): boolean {
  if (configured) return true
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
  configured = true
  return true
}

export function getVapidPublicKey(): string | null {
  return VAPID_PUBLIC || null
}

export function isPushConfigured(): boolean {
  return !!(VAPID_PUBLIC && VAPID_PRIVATE)
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
  icon?: string
}

export async function sendPushNotification(
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload
): Promise<{ ok: boolean; error?: string; statusCode?: number }> {
  if (!ensureConfigured()) {
    return { ok: false, error: 'VAPID not configured' }
  }
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify(payload)
    )
    return { ok: true }
  } catch (e: any) {
    return {
      ok: false,
      error: e?.message || 'send failed',
      statusCode: e?.statusCode,
    }
  }
}
