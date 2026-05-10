/**
 * Cron diário — persiste snapshot CEPEA (soja/milho/trigo) + BCB PTAX (USD/BRL).
 *
 * Trigger: Railway cron OU GitHub Actions (escolha em railway.toml ou
 * .github/workflows/cron-sync-cotacoes.yml — ver docs no PR).
 *
 * Auth: header `Authorization: Bearer ${CRON_SECRET}`
 * Schedule sugerido: 23:00 UTC (20:00 BRT) seg-sex, após fechamento CEPEA.
 *
 * Idempotente: usa upsert por (grao, data) onde `data` é o dia UTC truncado.
 * Rodar 2x no mesmo dia atualiza o registro existente.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchCepeaQuotes, type CepeaLabel } from '@/lib/quotes/cepea'
import { fetchBcbDolar } from '@/lib/quotes/bcb'
import { fetchQuoteBySymbol, TD_SYMBOLS } from '@/lib/quotes/twelvedata'
import { captureError, captureMessage } from '@/lib/observability/capture'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// Símbolos CBOT correspondentes — mantém compat com queries existentes
const SIMBOLO: Record<CepeaLabel, string> = { soja: 'ZS', milho: 'ZC', trigo: 'ZW' }

/** Trunca timestamp ao início do dia em UTC. */
function todayUtcMidnight(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

async function handle(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    captureMessage('cron sync-cotacoes: CRON_SECRET ausente', 'error')
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const dataDia = todayUtcMidnight()

  // Roda CEPEA (1 chamada agregando 3 indicadores) + BCB em paralelo
  const [cepeaRes, bcbRes] = await Promise.allSettled([
    fetchCepeaQuotes(['soja', 'milho', 'trigo']),
    fetchBcbDolar(),
  ])

  const summary: {
    ok: boolean
    savedAt: string
    elapsedMs: number
    sojaR$?: number | null
    milhoR$?: number | null
    trigoR$?: number | null
    usdBrl?: number | null
    saved: number
    errors: string[]
  } = {
    ok: true,
    savedAt: new Date().toISOString(),
    elapsedMs: 0,
    saved: 0,
    errors: [],
  }

  // Taxa USD/BRL — precisamos dela tanto para TaxaCambio quanto para enriquecer Cotacao
  let dolarReal: number | null = null
  if (bcbRes.status === 'fulfilled') {
    const venda = bcbRes.value.cotacaoVenda
    dolarReal = venda
    summary.usdBrl = venda
    if (venda != null) {
      try {
        await db.taxaCambio.upsert({
          where: { origem_destino_data: { origem: 'USD', destino: 'BRL', data: dataDia } },
          create: {
            origem: 'USD',
            destino: 'BRL',
            taxa: venda,
            fonte: 'BCB-PTAX',
            data: dataDia,
          },
          update: { taxa: venda, fonte: 'BCB-PTAX' },
        })
        summary.saved++
      } catch (e: any) {
        summary.errors.push(`taxaCambio: ${e?.message || e}`)
        captureError(e, { where: 'cron/sync-cotacoes/taxaCambio' })
      }
    } else {
      summary.errors.push('bcb: sem cotacaoVenda')
    }
  } else {
    summary.errors.push(`bcb: ${bcbRes.reason?.message || bcbRes.reason}`)
  }

  // CEPEA — 3 grãos
  if (cepeaRes.status === 'fulfilled') {
    const quotes = cepeaRes.value
    for (const label of ['soja', 'milho', 'trigo'] as CepeaLabel[]) {
      const q = quotes[label]
      const preco = q?.precoSc60
      // Espelha no summary mesmo se null (visibilidade)
      ;(summary as any)[`${label}R$`] = preco
      if (preco == null) {
        summary.errors.push(`cepea-${label}: preço indisponível`)
        continue
      }
      try {
        // QW7 — OHLC do dia via Twelve Data (ETF proxy CBOT). Best-effort:
        // se chave ausente / rate-limit / fora-de-pregão, mantém só close=preco
        // CEPEA. Free tier: 800 req/dia; 3 chamadas/dia aqui é desprezível.
        let ohlcOpen: number | null = null
        let ohlcHigh: number | null = null
        let ohlcLow: number | null = null
        let ohlcClose: number = preco
        try {
          const tdSym = TD_SYMBOLS[label].symbol
          const td = await fetchQuoteBySymbol(tdSym)
          if (td) {
            const toNum = (v: unknown) =>
              typeof v === 'number' ? v : v ? Number(v) : null
            const o = toNum(td.open)
            const h = toNum(td.high)
            const l = toNum(td.low)
            const c = toNum(td.close)
            // Twelve Data devolve USD/share. Pra preservar consistência (preco está
            // em R$/sc), normaliza pra fração do close CEPEA — mantém shape OHLC
            // sem distorcer escala. open/high/low são razões aplicadas ao close R$/sc.
            if (o && c && Number.isFinite(o) && Number.isFinite(c) && c !== 0) {
              ohlcOpen = +(preco * (o / c)).toFixed(2)
              if (h) ohlcHigh = +(preco * (h / c)).toFixed(2)
              if (l) ohlcLow  = +(preco * (l / c)).toFixed(2)
            }
          }
        } catch (e: any) {
          // OHLC falhou — não bloqueia o save principal
          captureMessage(`sync-cotacoes: OHLC ${label} indisponível (${e?.message || e})`, 'info')
        }

        await db.cotacao.upsert({
          where: { grao_data: { grao: label, data: dataDia } },
          create: {
            grao: label,
            preco,
            simbolo: SIMBOLO[label],
            fonte: 'CEPEA-ESALQ',
            dolarReal: dolarReal ?? undefined,
            data: dataDia,
            open: ohlcOpen ?? undefined,
            high: ohlcHigh ?? undefined,
            low: ohlcLow ?? undefined,
            close: ohlcClose,
          },
          update: {
            preco,
            simbolo: SIMBOLO[label],
            fonte: 'CEPEA-ESALQ',
            dolarReal: dolarReal ?? undefined,
            open: ohlcOpen ?? undefined,
            high: ohlcHigh ?? undefined,
            low: ohlcLow ?? undefined,
            close: ohlcClose,
          },
        })
        summary.saved++
      } catch (e: any) {
        summary.errors.push(`cepea-${label}: ${e?.message || e}`)
        captureError(e, { where: 'cron/sync-cotacoes/cotacao', grao: label })
      }
    }
  } else {
    summary.errors.push(`cepea: ${cepeaRes.reason?.message || cepeaRes.reason}`)
  }

  summary.elapsedMs = Date.now() - startedAt
  summary.ok = summary.saved > 0 && summary.errors.length === 0

  captureMessage(
    `cron sync-cotacoes ${summary.ok ? 'OK' : 'PARCIAL'} saved=${summary.saved} errors=${summary.errors.length}`,
    summary.ok ? 'info' : 'warning',
    { summary },
  )

  return NextResponse.json(summary, { status: summary.saved > 0 ? 200 : 502 })
}

export const GET = handle
export const POST = handle
