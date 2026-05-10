/**
 * Cron diário — envia resumo de cotações via WhatsApp para destinatários
 * configurados em `WHATSAPP_DAILY_RECIPIENTS` (CSV de números E.164).
 *
 * Trigger: GitHub Actions (.github/workflows/cron-whatsapp-cotacao-diaria.yml)
 * Auth: header `Authorization: Bearer ${CRON_SECRET}`
 * Schedule: 11:00 UTC (08:00 BRT) seg-sex.
 *
 * Comportamento:
 *  - Sem destinatários configurados → retorna ok=true, sent=0 (não falha).
 *  - Sem cotação anterior (D-1) → omite a variação%.
 *  - Coleta sucessos/falhas por destinatário; erro individual não derruba o cron.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendText, getDefaultInstance } from '@/lib/whatsapp/evolution'
import { captureError, captureMessage } from '@/lib/observability/capture'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

type Grao = 'soja' | 'milho' | 'trigo'

const EMOJI: Record<Grao, string> = {
  soja: '🟢',
  milho: '🟡',
  trigo: '🟠',
}

const LABEL: Record<Grao, string> = {
  soja: 'Soja',
  milho: 'Milho',
  trigo: 'Trigo',
}

function formatBR(n: number, digits = 2): string {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function formatDateTimeBR(d: Date): string {
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

async function buildMessage(): Promise<string> {
  const graos: Grao[] = ['soja', 'milho', 'trigo']

  // Última cotação por grão
  const latestPerGrao = await Promise.all(
    graos.map((g) =>
      db.cotacao.findFirst({
        where: { grao: g },
        orderBy: { data: 'desc' },
      })
    )
  )

  // Penúltima (para variação%)
  const previousPerGrao = await Promise.all(
    graos.map((g, i) => {
      const latest = latestPerGrao[i]
      if (!latest) return Promise.resolve(null)
      return db.cotacao.findFirst({
        where: { grao: g, data: { lt: latest.data } },
        orderBy: { data: 'desc' },
      })
    })
  )

  const latestUsd = await db.taxaCambio.findFirst({
    where: { origem: 'USD', destino: 'BRL' },
    orderBy: { data: 'desc' },
  })

  const lines: string[] = []
  lines.push(`🌾 *Cotações de hoje — PHB Grain*`)
  lines.push('')

  graos.forEach((g, i) => {
    const cur = latestPerGrao[i]
    const prev = previousPerGrao[i]
    if (!cur) {
      lines.push(`${EMOJI[g]} ${LABEL[g]}: indisponível`)
      return
    }
    const precoNum = Number(cur.preco)
    const isTrigoTon = g === 'trigo' && precoNum > 500 // heurística: trigo costuma ser por tonelada
    const unidade = isTrigoTon ? '/t' : '/sc'

    let variacaoStr = ''
    if (prev) {
      const prevNum = Number(prev.preco)
      if (prevNum > 0) {
        const delta = ((precoNum - prevNum) / prevNum) * 100
        if (Math.abs(delta) < 0.05) {
          variacaoStr = ' (estável)'
        } else {
          const sign = delta > 0 ? '+' : ''
          variacaoStr = ` (${sign}${formatBR(delta, 1)}%)`
        }
      }
    }

    lines.push(
      `${EMOJI[g]} ${LABEL[g]}: R$ ${formatBR(precoNum)}${unidade}${variacaoStr}`
    )
  })

  if (latestUsd) {
    lines.push(`💵 USD/BRL: R$ ${formatBR(Number(latestUsd.taxa), 2)}`)
  }

  lines.push('')
  lines.push(`📊 Atualizado em ${formatDateTimeBR(new Date())}`)
  lines.push('')
  lines.push(`Ver detalhes: https://www.profitsync.ia.br/cotacoes`)

  return lines.join('\n')
}

async function handle(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    captureMessage('cron whatsapp-cotacao-diaria: CRON_SECRET ausente', 'error')
    return NextResponse.json(
      { error: 'server_misconfigured' },
      { status: 500 }
    )
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const recipientsRaw = (process.env.WHATSAPP_DAILY_RECIPIENTS || '').trim()
  const globalRecipients = recipientsRaw
    ? recipientsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []

  // Multi-tenant: workspaces com instância conectada
  const connectedInstances = await db.whatsAppInstance.findMany({
    where: { status: 'connected' },
    select: { id: true, workspaceId: true, instanceName: true },
  })

  if (globalRecipients.length === 0 && connectedInstances.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      failed: 0,
      message: 'no recipients configured and no workspace instances connected',
    })
  }

  let message: string
  try {
    message = await buildMessage()
  } catch (e: any) {
    captureError(e, { where: 'cron/whatsapp-cotacao-diaria/buildMessage' })
    return NextResponse.json(
      { ok: false, error: e?.message || 'failed to build message' },
      { status: 500 }
    )
  }

  let sent = 0
  let failed = 0
  let totalTargets = 0
  const errors: string[] = []

  // 1) Fallback global via env (legacy) — usa instância default
  if (globalRecipients.length > 0) {
    const defaultInstance = getDefaultInstance()
    for (const number of globalRecipients) {
      totalTargets++
      try {
        await sendText(defaultInstance, number, message)
        sent++
      } catch (err: any) {
        failed++
        const msg = err?.message || 'unknown'
        errors.push(`[global ${number}] ${msg}`)
        captureError(err, {
          where: 'cron/whatsapp-cotacao-diaria/sendText',
          scope: 'global',
          number,
        })
      }
    }
  }

  // 2) Multi-tenant — para cada workspace conectado, envia pra members do workspace
  //    com telefone preenchido em WorkspaceMember.user.telefone? — neste schema
  //    User não tem telefone, então usamos DadosEmpresa.telefone como fallback,
  //    e/ou WHATSAPP_DAILY_RECIPIENTS específico do workspace via env CSV
  //    (TODO: schema dedicado pra opt-in por member).
  for (const wsInst of connectedInstances) {
    const empresa = await db.dadosEmpresa.findUnique({
      where: { workspaceId: wsInst.workspaceId },
      select: { telefone: true },
    })
    const wsRecipients: string[] = []
    if (empresa?.telefone) wsRecipients.push(empresa.telefone)

    for (const number of wsRecipients) {
      totalTargets++
      try {
        await sendText(wsInst.instanceName, number, message)
        sent++
      } catch (err: any) {
        failed++
        const msg = err?.message || 'unknown'
        errors.push(`[ws=${wsInst.workspaceId} ${number}] ${msg}`)
        captureError(err, {
          where: 'cron/whatsapp-cotacao-diaria/sendText',
          scope: 'workspace',
          workspaceId: wsInst.workspaceId,
          instanceName: wsInst.instanceName,
          number,
        })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    failed,
    total: totalTargets,
    instances: {
      global: globalRecipients.length,
      workspaces: connectedInstances.length,
    },
    message: `enviado para ${sent}/${totalTargets} destinatários`,
    errors: errors.length ? errors : undefined,
  })
}

export async function GET(req: Request) {
  return handle(req)
}

export async function POST(req: Request) {
  return handle(req)
}
