/**
 * Cron HOT — preço ao vivo de ALTA FREQUÊNCIA (intradiário durante o pregão).
 *
 * Diferente do `sync-cotacoes` (diário, persiste snapshot CEPEA + PTAX), este
 * cron roda a cada poucos minutos DURANTE O PREGÃO CBOT (11h-15h30 BRT, dias
 * úteis) para manter o cache do servidor quente com o último CBOT (¢/bu) e o
 * dólar. Fora do pregão retorna rápido sem gastar nenhuma chamada externa.
 *
 * Fontes:
 *  - CBOT (Yahoo Finance via fetchCbotQuotes) → fonte de rate-budget: 'yahoo'
 *  - Dólar (BCB PTAX; fallback AwesomeAPI)    → fonte de rate-budget: 'awesomeapi'
 *
 * Disciplina de orçamento: antes de cada fonte chama `podeConsultar(fonte)`.
 * Se ok=false (teto de 80% atingido) NÃO bate na API — serve o último valor do
 * cache (as funções de fetch cacheiam internamente). `registrarConsulta` é
 * chamado SOMENTE quando efetivamente consultamos.
 *
 * Persistência: NÃO cria linhas novas no banco. Apenas (a) aquece o cache do
 * servidor (efeito colateral dos fetch) e (b) se já existir o registro do dia
 * em `Cotacao` (criado pelo cron diário), atualiza `cbotCents`/`dolarReal` via
 * updateMany — nunca faz upsert/insert, evitando lixo de linhas parciais.
 *
 * Auth: header `Authorization: Bearer ${CRON_SECRET}` (401 se ausente/errado).
 * Trigger: GitHub Actions (>=5min) OU cron externo (cron-job.org) no mesmo
 * endpoint. Nunca lança: try/catch externo sempre devolve 200.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchCbotQuotes, type GraoCbot } from '@/lib/quotes/cbot'
import { fetchBcbDolar } from '@/lib/quotes/bcb'
import { fetchFxBidAsk } from '@/lib/quotes/awesomeapi'
import { marketStatus } from '@/lib/quotes/market-hours'
import {
  podeConsultar,
  registrarConsulta,
  statusBudget,
} from '@/lib/quotes/rate-budget'
import { captureError, captureMessage } from '@/lib/observability/capture'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'
export const maxDuration = 30

const GRAOS: GraoCbot[] = ['soja', 'milho', 'trigo']
const SIMBOLO: Record<GraoCbot, string> = { soja: 'ZS', milho: 'ZC', trigo: 'ZW' }

/** Trunca timestamp ao início do dia em UTC (mesma chave do cron diário). */
function todayUtcMidnight(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

async function handle(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    captureMessage('cron sync-hot: CRON_SECRET ausente', 'error')
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const atualizadoEm = new Date().toISOString()

  try {
    // ── Gate de pregão: só busca durante o pregão CBOT ──────────────────────
    const status = marketStatus('cbot')
    if (!status.open) {
      return NextResponse.json({
        ok: true,
        pulado: 'fora_pregao',
        atualizadoEm,
        motivo: status.reason,
        proximaAbertura: status.nextOpen,
      })
    }

    // Marca quais fontes foram puladas por orçamento (servindo cache/último).
    const motivos: Record<string, string> = {}
    const fontesUsadas: string[] = []

    // ── CBOT (Yahoo) — fonte 'yahoo' ─────────────────────────────────────────
    let cbot: Record<GraoCbot, number | null> = { soja: null, milho: null, trigo: null }
    const podeYahoo = await podeConsultar('yahoo')
    if (podeYahoo.ok) {
      // fetchCbotQuotes cacheia internamente (TTL 5min) — também aquece o cache.
      cbot = await fetchCbotQuotes()
      await registrarConsulta('yahoo')
      fontesUsadas.push('yahoo')
    } else {
      // Serve o último valor do cache (fetch devolve cache stale se houver),
      // sem registrar consulta nem forçar rede além do TTL.
      cbot = await fetchCbotQuotes()
      motivos['yahoo'] = 'budget'
    }

    // ── Dólar — BCB PTAX primeiro; AwesomeAPI como fallback (fonte 'awesomeapi') ─
    let cambio: number | null = null
    let fonteCambio: string | null = null
    try {
      const bcb = await fetchBcbDolar()
      // PTAX é pública sem chave/limite — não consome rate-budget próprio.
      cambio = bcb.cotacaoVenda ?? bcb.cotacaoCompra ?? null
      if (cambio != null) fonteCambio = 'BCB-PTAX'
    } catch (e: any) {
      captureMessage(`sync-hot: BCB indisponível (${e?.message || e})`, 'info')
    }
    if (cambio == null) {
      const podeFx = await podeConsultar('awesomeapi')
      if (podeFx.ok) {
        const fx = await fetchFxBidAsk('USD-BRL')
        cambio = fx.ask ?? fx.bid ?? null
        await registrarConsulta('awesomeapi')
        fontesUsadas.push('awesomeapi')
        if (cambio != null) fonteCambio = 'awesomeapi'
      } else {
        // Último valor de cache da AwesomeAPI (best-effort) sem registrar.
        const fx = await fetchFxBidAsk('USD-BRL')
        cambio = fx.ask ?? fx.bid ?? null
        if (cambio != null) fonteCambio = 'awesomeapi-cache'
        motivos['awesomeapi'] = 'budget'
      }
    }

    // ── Persistência leve: atualiza SÓ o registro do dia se já existir ───────
    // Não cria linhas: o cron diário (sync-cotacoes) é dono do insert por dia.
    const dataDia = todayUtcMidnight()
    let atualizados = 0
    for (const grao of GRAOS) {
      const cbotCents = cbot[grao]
      if (cbotCents == null && cambio == null) continue
      try {
        const data: { cbotCents?: number; dolarReal?: number } = {}
        if (cbotCents != null) data.cbotCents = cbotCents
        if (cambio != null) data.dolarReal = cambio
        const res = await db.cotacao.updateMany({
          where: { grao, simbolo: SIMBOLO[grao], data: dataDia },
          data,
        })
        atualizados += res.count
      } catch (e: any) {
        captureError(e, { where: 'cron/sync-hot/updateMany', grao })
      }
    }

    const budget = await statusBudget()
    const ok = fontesUsadas.length > 0

    return NextResponse.json({
      ok,
      atualizadoEm,
      cbot,
      cambio: { valor: cambio, fonte: fonteCambio },
      registrosAtualizados: atualizados,
      fontesUsadas,
      motivos,
      budget,
    })
  } catch (err: any) {
    captureError(err, { where: 'cron/sync-hot' })
    let budget: Awaited<ReturnType<typeof statusBudget>> = {}
    try {
      budget = await statusBudget()
    } catch {
      budget = {}
    }
    // Sempre 200 (best-effort): degradação graciosa.
    return NextResponse.json({
      ok: false,
      atualizadoEm,
      erro: err?.message || 'falha no sync-hot',
      budget,
    })
  }
}

export const GET = handle
export const POST = handle
