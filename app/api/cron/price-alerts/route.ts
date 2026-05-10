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
import { fetchQuoteBySymbol, TD_SYMBOLS } from '@/lib/quotes/twelvedata'
import { fetchBcbDolar } from '@/lib/quotes/bcb'

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

    // Cache pra evitar refetch USD/BRL N vezes
    let cachedDolar: number | null = null
    async function getDolar(): Promise<number | null> {
      if (cachedDolar != null) return cachedDolar
      const r = await fetchBcbDolar()
      const v = r.cotacaoVenda
      cachedDolar = v
      return v
    }

    // Conversão CBOT (cents/bushel) → R$/sc (60kg) por grão
    // bushels/ton: soja=36.74, milho=39.37, trigo=36.74 ⇒ sc60kg = ton*16.6667
    const BUSHELS_PER_SC60: Record<string, number> = {
      soja: 36.7437 * 0.06,   // ~2.2046
      milho: 39.3683 * 0.06,  // ~2.3621
      trigo: 36.7437 * 0.06,
    }
    function cbotToRsSc(centsPerBushel: number, grao: string, usdBrl: number): number {
      const usdPerBushel = centsPerBushel / 100
      const bushelsPerSc = BUSHELS_PER_SC60[grao] ?? 2.2
      return usdPerBushel * bushelsPerSc * usdBrl
    }

    for (const a of alertas) {
      try {
        const op = a.operador
        const alvo = Number(a.preco)
        let valorComparado: number | null = null
        let fonteLabel = 'CEPEA'

        if (a.tipo === 'cambio') {
          // alvo é USD/BRL — compara contra PTAX atual
          valorComparado = await getDolar()
          fonteLabel = 'BCB-PTAX'
        } else if (a.tipo === 'basis') {
          // Basis = preço CEPEA - preço CBOT convertido R$/sc.
          // Útil para mesa: avisa quando spread interno fica grande/pequeno.
          const last = await db.cotacao.findFirst({
            where: { grao: a.graoLabel },
            orderBy: { data: 'desc' },
          })
          if (!last) continue
          const dolar = await getDolar()
          if (!dolar) continue
          const tdSym = TD_SYMBOLS[a.graoLabel as keyof typeof TD_SYMBOLS]?.symbol
          if (!tdSym) continue
          const td = await fetchQuoteBySymbol(tdSym)
          const cbotClose = td && typeof td.close !== 'undefined' ? Number(td.close) : null
          if (!cbotClose || !Number.isFinite(cbotClose)) continue
          const cbotRsSc = cbotToRsSc(cbotClose, a.graoBase || a.graoLabel, dolar)
          valorComparado = Number(last.preco) - cbotRsSc
          fonteLabel = 'CEPEA−CBOT(USD→BRL)'
        } else {
          // tipo='preco' (default) — comportamento original
          const last = await db.cotacao.findFirst({
            where: { grao: a.graoLabel },
            orderBy: { data: 'desc' },
          })
          if (!last) continue
          valorComparado = Number(last.preco)
          fonteLabel = last.fonte
        }

        if (valorComparado == null || !Number.isFinite(valorComparado)) continue
        const preco = valorComparado
        const condition = (op === '>' && preco >= alvo) || (op === '<' && preco <= alvo)
        if (!condition) continue
        // Cooldown
        if (a.notifEnviadoEm && a.notifEnviadoEm > cooldownThreshold) continue

        const email = a.workspace?.owner?.email
        const name = a.workspace?.owner?.nome || 'operador'
        if (!email) continue

        const moeda = a.tipo === 'cambio' ? 'R$' : a.tipo === 'basis' ? 'Δ R$' : 'R$'
        const alvoLabel = `${op === '>' ? '≥' : '≤'} ${moeda} ${alvo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        const labelGrao = a.tipo === 'cambio' ? 'USD/BRL'
          : a.tipo === 'basis' ? `BASIS ${a.graoLabel}` : a.graoLabel
        const tpl = priceAlertTemplate({
          name,
          granoLabel: labelGrao,
          precoAtual: preco,
          alvoLabel,
          fonte: fonteLabel,
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
