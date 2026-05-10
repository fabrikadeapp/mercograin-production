/**
 * Cron — verifica alertas de preço vs cotações mais recentes e envia emails.
 *
 * Auth: header `Authorization: Bearer ${CRON_SECRET}`
 * Schedule sugerido: a cada 15-30 min em horário de pregão.
 *
 * Lógica:
 *   - Para cada AlertaPreco com status='ativo':
 *     - Buscar cotação mais recente do grão
 *     - Se condição (operador + preco) é satisfeita E não disparou nas últimas 12h
 *       → enviar email + atualizar ultimoDisparo + notifEnviadoEm + status='disparado'
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email/send'
import { priceAlertTemplate } from '@/lib/email/templates/price-alert'
import { captureError, captureMessage } from '@/lib/observability/capture'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const COOLDOWN_HOURS = 12

async function handle(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    captureMessage('cron price-alerts: CRON_SECRET ausente', 'error')
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const cooldownThreshold = new Date(now.getTime() - COOLDOWN_HOURS * 60 * 60 * 1000)
  const sent: string[] = []
  const errors: string[] = []

  try {
    const alertas = await db.alertaPreco.findMany({
      where: { status: 'ativo' },
      include: {
        workspace: {
          select: { name: true, owner: { select: { email: true, nome: true } } },
        },
      },
    })

    for (const a of alertas) {
      try {
        // Última cotação do grão
        const last = await db.cotacao.findFirst({
          where: { grao: a.graoLabel },
          orderBy: { data: 'desc' },
        })
        if (!last) continue
        const preco = Number(last.preco)
        const alvo = Number(a.preco)
        const op = a.operador
        const condition = (op === '>' && preco >= alvo) || (op === '<' && preco <= alvo)
        if (!condition) continue
        // Cooldown
        if (a.notifEnviadoEm && a.notifEnviadoEm > cooldownThreshold) continue

        const email = a.workspace?.owner?.email
        const name = a.workspace?.owner?.nome || 'operador'
        if (!email) continue

        const alvoLabel = `${op === '>' ? '≥' : '≤'} R$ ${alvo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        const tpl = priceAlertTemplate({
          name,
          granoLabel: a.graoLabel,
          precoAtual: preco,
          alvoLabel,
          fonte: last.fonte,
        })
        const r = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text })
        if (r) {
          await db.alertaPreco.update({
            where: { id: a.id },
            data: {
              ultimoDisparo: new Date(),
              notifEnviadoEm: new Date(),
              status: 'disparado',
            },
          })
          sent.push(a.id)
        }
      } catch (e: any) {
        errors.push(`alerta=${a.id}: ${e?.message || e}`)
        captureError(e, { where: 'cron/price-alerts/loop', alertaId: a.id })
      }
    }
  } catch (e: any) {
    errors.push(`query: ${e?.message || e}`)
    captureError(e, { where: 'cron/price-alerts/query' })
  }

  const summary = { ok: errors.length === 0, sent: sent.length, ids: sent, errors }
  captureMessage(
    `cron price-alerts ${summary.ok ? 'OK' : 'PARCIAL'} sent=${sent.length} errors=${errors.length}`,
    summary.ok ? 'info' : 'warning',
    { summary }
  )
  return NextResponse.json(summary, { status: 200 })
}

export const GET = handle
export const POST = handle
