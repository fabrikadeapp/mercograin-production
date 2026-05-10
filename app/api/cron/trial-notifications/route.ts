/**
 * Cron — envia emails de fim de trial.
 *
 * Auth: header `Authorization: Bearer ${CRON_SECRET}`
 * Schedule sugerido: diário às 13:00 UTC (10:00 BRT).
 *
 * Idempotente:
 *   - trial-ending: dispara 1x quando trialEnd entre [now+2.5d, now+3.5d] e
 *     notifTrialEndingAt IS NULL.
 *   - trial-expired: dispara 1x quando trialEnd < now, status='trialing' e
 *     notifTrialExpiredAt IS NULL.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email/send'
import { trialEndingTemplate } from '@/lib/email/templates/trial-ending'
import { trialExpiredTemplate } from '@/lib/email/templates/trial-expired'
import { captureError, captureMessage } from '@/lib/observability/capture'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

async function handle(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    captureMessage('cron trial-notifications: CRON_SECRET ausente', 'error')
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const lower = new Date(now.getTime() + 2.5 * 24 * 60 * 60 * 1000)
  const upper = new Date(now.getTime() + 3.5 * 24 * 60 * 60 * 1000)

  let endingSent = 0
  let expiredSent = 0
  const errors: string[] = []

  // ----- Trial Ending (≈3 dias antes) -----
  try {
    const ending = await db.subscription.findMany({
      where: {
        trialEnd: { gte: lower, lte: upper },
        notifTrialEndingAt: null,
      },
      include: {
        workspace: {
          select: {
            name: true,
            owner: { select: { email: true, nome: true } },
          },
        },
      },
    })

    for (const sub of ending) {
      const email = sub.workspace?.owner?.email
      const name = sub.workspace?.owner?.nome || 'usuário'
      if (!email || !sub.trialEnd) continue
      const daysLeft = Math.max(
        0,
        Math.round((sub.trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      )
      try {
        const tpl = trialEndingTemplate({
          name,
          workspaceName: sub.workspace?.name,
          daysLeft,
          planName: sub.plan,
        })
        const r = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text })
        if (r) {
          await db.subscription.update({
            where: { id: sub.id },
            data: { notifTrialEndingAt: new Date() },
          })
          endingSent++
        }
      } catch (e: any) {
        errors.push(`ending sub=${sub.id}: ${e?.message || e}`)
        captureError(e, { where: 'cron/trial-notifications/ending', subscriptionId: sub.id })
      }
    }
  } catch (e: any) {
    errors.push(`ending query: ${e?.message || e}`)
    captureError(e, { where: 'cron/trial-notifications/ending-query' })
  }

  // ----- Trial Expired -----
  try {
    const expired = await db.subscription.findMany({
      where: {
        trialEnd: { lt: now },
        status: 'trialing',
        notifTrialExpiredAt: null,
      },
      include: {
        workspace: {
          select: { owner: { select: { email: true, nome: true } } },
        },
      },
    })

    for (const sub of expired) {
      const email = sub.workspace?.owner?.email
      const name = sub.workspace?.owner?.nome || 'usuário'
      if (!email) continue
      try {
        const tpl = trialExpiredTemplate({ name })
        const r = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text })
        if (r) {
          await db.subscription.update({
            where: { id: sub.id },
            data: { notifTrialExpiredAt: new Date() },
          })
          expiredSent++
        }
      } catch (e: any) {
        errors.push(`expired sub=${sub.id}: ${e?.message || e}`)
        captureError(e, { where: 'cron/trial-notifications/expired', subscriptionId: sub.id })
      }
    }
  } catch (e: any) {
    errors.push(`expired query: ${e?.message || e}`)
    captureError(e, { where: 'cron/trial-notifications/expired-query' })
  }

  const summary = { ok: errors.length === 0, endingSent, expiredSent, errors }
  captureMessage(
    `cron trial-notifications ${summary.ok ? 'OK' : 'PARCIAL'} ending=${endingSent} expired=${expiredSent} errors=${errors.length}`,
    summary.ok ? 'info' : 'warning',
    { summary }
  )
  return NextResponse.json(summary, { status: 200 })
}

export const GET = handle
export const POST = handle
