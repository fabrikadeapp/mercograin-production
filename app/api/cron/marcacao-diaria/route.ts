/**
 * Cron diário — marcação a mercado de TODAS as posições de hedge abertas.
 *
 * Trigger: GitHub Actions ou Railway cron, schedule sugerido 18:00 UTC (15:00 BRT)
 * seg-sex, após fechamento do mercado.
 *
 * Auth: header `Authorization: Bearer ${CRON_SECRET}`
 *
 * Idempotente: usa upsert por (posicaoHedgeId, data) onde `data` é o dia UTC truncado.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcularPnL } from '@/lib/hedge/pnl'
import {
  CBOT_CONTRATO,
  precoBrlScParaUsdBu,
  type CulturaCbot,
} from '@/lib/hedge/conversao'
import { captureError, captureMessage } from '@/lib/observability/capture'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const CULTURA_TO_CBOT: Record<string, CulturaCbot> = {
  soja: 'ZS',
  milho: 'ZC',
  trigo: 'ZW',
}

function todayUtcMidnight(): Date {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
}

async function handle(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    captureMessage('cron marcacao-diaria: CRON_SECRET ausente', 'error')
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const dia = todayUtcMidnight()

  // Última taxa de câmbio
  const tx = await db.taxaCambio.findFirst({
    where: { origem: 'USD', destino: 'BRL' },
    orderBy: { data: 'desc' },
  })
  const cambio = tx ? Number(tx.taxa) : null

  if (!cambio) {
    return NextResponse.json(
      { error: 'taxa_cambio_indisponivel' },
      { status: 503 }
    )
  }

  // Última cotação por grão
  const [sojaCot, milhoCot, trigoCot] = await Promise.all([
    db.cotacao.findFirst({ where: { grao: 'soja' }, orderBy: { data: 'desc' } }),
    db.cotacao.findFirst({ where: { grao: 'milho' }, orderBy: { data: 'desc' } }),
    db.cotacao.findFirst({ where: { grao: 'trigo' }, orderBy: { data: 'desc' } }),
  ])
  const cotMap: Record<string, number | null> = {
    soja: sojaCot ? Number(sojaCot.preco) : null,
    milho: milhoCot ? Number(milhoCot.preco) : null,
    trigo: trigoCot ? Number(trigoCot.preco) : null,
  }

  // Posições abertas com dados completos
  const posicoes = await db.posicaoHedge.findMany({
    where: {
      status: 'aberta',
      precoEntradaUsdBu: { not: null },
      cambioEntradaUsdBrl: { not: null },
      cultura: { not: null },
    },
  })

  let marcadas = 0
  let pulou = 0
  const erros: string[] = []

  for (const pos of posicoes) {
    try {
      const sym = pos.cultura ? CULTURA_TO_CBOT[pos.cultura] : null
      if (!sym) {
        pulou++
        continue
      }
      const brlSc = cotMap[pos.cultura ?? '']
      if (!brlSc) {
        pulou++
        continue
      }
      const precoUsdBu = precoBrlScParaUsdBu(
        brlSc,
        cambio,
        CBOT_CONTRATO[sym].kgPorBushel
      )

      const r = calcularPnL(
        {
          tipo: pos.tipo as 'long' | 'short',
          qtdContratos: Number(pos.qtdContratos),
          cultura: sym,
          precoEntradaUsdBu: Number(pos.precoEntradaUsdBu),
          cambioEntradaUsdBrl: Number(pos.cambioEntradaUsdBrl),
          corretagemUSD: Number(pos.corretagemUSD ?? 0),
        },
        { precoMercadoUsdBu: precoUsdBu, cambioMercadoUsdBrl: cambio }
      )

      const previa = await db.marcacaoMercado.findFirst({
        where: { posicaoHedgeId: pos.id, data: { lt: dia } },
        orderBy: { data: 'desc' },
      })

      const variacaoDiaUSD = previa
        ? r.pnlUSD - Number(previa.pnlUnrealizedUSD)
        : null
      const variacaoDiaBRL = previa
        ? r.pnlBRL - Number(previa.pnlUnrealizedBRL)
        : null

      const cot =
        pos.cultura === 'soja' ? sojaCot : pos.cultura === 'milho' ? milhoCot : trigoCot
      const inputsSnapshot = {
        cotacaoId: cot?.id ?? null,
        cotacaoData: cot?.data?.toISOString?.() ?? null,
        precoMercadoBrlSc: brlSc,
        precoMercadoUsdBu: precoUsdBu,
        cambioId: tx?.id ?? null,
        cambioData: tx?.data?.toISOString?.() ?? null,
        cambioUsdBrl: cambio,
        pnlFormula:
          'pnl_usd = sinal * (mkt - entrada) * qtdContratos * 5000 - corretagem',
        kgPorBushel: CBOT_CONTRATO[sym].kgPorBushel,
      }
      await db.marcacaoMercado.upsert({
        where: {
          posicaoHedgeId_data: { posicaoHedgeId: pos.id, data: dia },
        },
        create: {
          workspaceId: pos.workspaceId,
          posicaoHedgeId: pos.id,
          data: dia,
          precoMercadoUsdBu: precoUsdBu,
          precoMercadoBrlSc: brlSc,
          cambioUsdBrl: cambio,
          pnlUnrealizedUSD: r.pnlUSD,
          pnlUnrealizedBRL: r.pnlBRL,
          variacaoDiaUSD,
          variacaoDiaBRL,
          inputsSnapshot,
          calcMetodo: 'cron_marcacao_diaria',
          calcVersao: 'v1',
        },
        update: {
          precoMercadoUsdBu: precoUsdBu,
          precoMercadoBrlSc: brlSc,
          cambioUsdBrl: cambio,
          pnlUnrealizedUSD: r.pnlUSD,
          pnlUnrealizedBRL: r.pnlBRL,
          variacaoDiaUSD,
          variacaoDiaBRL,
          inputsSnapshot,
          calcMetodo: 'cron_marcacao_diaria',
          calcVersao: 'v1',
        },
      })
      marcadas++
    } catch (err: any) {
      erros.push(`${pos.id}: ${err?.message ?? 'erro'}`)
      captureError(err, { posicaoId: pos.id, route: 'cron/marcacao-diaria' })
    }
  }

  return NextResponse.json({
    ok: true,
    elapsedMs: Date.now() - startedAt,
    dia: dia.toISOString(),
    cambio,
    posicoesAbertas: posicoes.length,
    marcadas,
    pulou,
    erros,
  })
}

export async function GET(req: Request) {
  return handle(req)
}
export async function POST(req: Request) {
  return handle(req)
}
