/**
 * Unified email sender — Resend SDK wrapper.
 *
 * Graceful degradation: returns null (never throws) if RESEND_API_KEY missing
 * or send fails. Production logs go through observability/capture.
 */
import { Resend } from 'resend'
import { captureError, captureMessage } from '@/lib/observability/capture'

let cached: Resend | null = null
function client(): Resend {
  if (cached) return cached
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY não configurada')
  cached = new Resend(key)
  return cached
}

export const FROM = process.env.EMAIL_FROM || 'PHB Grain <noreply@profitsync.ia.br>'

export interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  tags?: { name: string; value: string }[]
}

export async function sendEmail(p: SendEmailParams): Promise<{ id: string } | null> {
  if (process.env.NODE_ENV === 'test') {
    // Em testes, apenas loga — não chama Resend.
    console.log('[email:test]', p.subject, '→', Array.isArray(p.to) ? p.to.join(',') : p.to)
    return { id: 'test' }
  }
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY missing, skipping send')
    return null
  }
  try {
    const r = await client().emails.send({
      from: FROM,
      to: Array.isArray(p.to) ? p.to : [p.to],
      subject: p.subject,
      html: p.html,
      text: p.text,
      replyTo: p.replyTo,
      tags: p.tags,
    })
    if (r.error) {
      captureMessage('[email] send failed', 'warning', { error: r.error, subject: p.subject })
      console.error('[email] send failed:', r.error)
      return null
    }
    return r.data ? { id: r.data.id } : null
  } catch (e: any) {
    captureError(e, { where: 'lib/email/send', subject: p.subject })
    console.error('[email] exception:', e?.message)
    return null
  }
}
