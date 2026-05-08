/**
 * GET /api/cotacoes/historia?grao=soja&modo=fisico|fob|b3|cbot&dias=240
 *
 * Retorna histórico de preços para o gráfico "Curva de Mercado", suportando
 * 4 mercados:
 *   - fisico  → CEPEA/ESALQ à vista (R$/sc 60kg)              · banco local
 *   - fob     → CEPEA FOB Paranaguá (R$/sc 60kg)              · banco local (TODO)
 *   - b3      → B3 contrato futuro SFI (R$/sc 60kg)           · não temos API gratuita
 *   - cbot    → CBOT futuros via ETF Teucrium (USD/cota)      · Twelve Data
 *
 * Empty state quando não houver dados.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { fetchHistorico } from '@/lib/quotes/twelvedata'

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const ETF_BY_GRAIN: Record<string, string> = {
  soja: 'SOYB',
  milho: 'CORN',
  trigo: 'WEAT',
}

type Modo = 'fisico' | 'fob' | 'b3' | 'cbot'

interface HistoriaResponse {
  data: { label: string; value: number; ts?: string }[]
  empty: boolean
  modo: Modo
  fonte: string
  unidade: string
  moeda: string
  ticker?: string
  observacao?: string
}

function emptyResp(modo: Modo, msg: string, fonte: string, unidade: string, moeda: string): HistoriaResponse {
  return { data: [], empty: true, modo, fonte, unidade, moeda, observacao: msg }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const { searchParams } = new URL(req.url)
    const grao = (searchParams.get('grao') || 'soja').toLowerCase()
    const modoRaw = (searchParams.get('modo') || 'fisico').toLowerCase() as Modo
    const modo: Modo = ['fisico', 'fob', 'b3', 'cbot'].includes(modoRaw) ? modoRaw : 'fisico'
    const dias = Math.min(720, parseInt(searchParams.get('dias') || '240'))

    // === FÍSICO (CEPEA à vista) — banco local
    if (modo === 'fisico') {
      const desde = new Date(Date.now() - dias * 86400000)
      const rows = await db.cotacao.findMany({
        where: { grao, fonte: 'cepea', data: { gte: desde } },
        select: { data: true, preco: true },
        orderBy: { data: 'asc' },
      })
      if (rows.length === 0) {
        return NextResponse.json(emptyResp(modo, 'Sem histórico CEPEA ainda', 'CEPEA · ESALQ', 'R$/sc 60kg', 'BRL'))
      }
      // agrega por mês (média)
      const buckets: Record<string, { sum: number; n: number; ts: number }> = {}
      for (const r of rows) {
        const d = new Date(r.data)
        const key = `${d.getFullYear()}-${d.getMonth()}`
        if (!buckets[key]) buckets[key] = { sum: 0, n: 0, ts: d.getTime() }
        buckets[key].sum += Number(r.preco)
        buckets[key].n += 1
      }
      const data = Object.entries(buckets)
        .sort((a, b) => a[1].ts - b[1].ts)
        .map(([key, b]) => {
          const [, m] = key.split('-')
          return {
            label: MESES_PT[parseInt(m)],
            value: Math.round((b.sum / b.n) * 100) / 100,
            ts: new Date(b.ts).toISOString(),
          }
        })
      return NextResponse.json<HistoriaResponse>({
        data, empty: false, modo, fonte: 'CEPEA · ESALQ',
        unidade: 'R$/sc 60kg', moeda: 'BRL',
      })
    }

    // === FOB Paranaguá — CEPEA FOB (preserva mesma escala R$/sc)
    // TODO: integrar widget CEPEA com indicador FOB. Por enquanto deriva
    // do físico aplicando spread médio FOB de +R$ 4,00/sc.
    if (modo === 'fob') {
      const desde = new Date(Date.now() - dias * 86400000)
      const rows = await db.cotacao.findMany({
        where: { grao, fonte: 'cepea', data: { gte: desde } },
        select: { data: true, preco: true },
        orderBy: { data: 'asc' },
      })
      if (rows.length === 0) {
        return NextResponse.json(emptyResp(modo, 'Sem histórico FOB', 'CEPEA · FOB Paranaguá (estimado)', 'R$/sc 60kg', 'BRL'))
      }
      const FOB_PREMIUM = 4.0  // R$/sc — proxy estimado, ajusta para histórico oficial
      const buckets: Record<string, { sum: number; n: number; ts: number }> = {}
      for (const r of rows) {
        const d = new Date(r.data)
        const key = `${d.getFullYear()}-${d.getMonth()}`
        if (!buckets[key]) buckets[key] = { sum: 0, n: 0, ts: d.getTime() }
        buckets[key].sum += Number(r.preco) + FOB_PREMIUM
        buckets[key].n += 1
      }
      const data = Object.entries(buckets)
        .sort((a, b) => a[1].ts - b[1].ts)
        .map(([key, b]) => {
          const [, m] = key.split('-')
          return {
            label: MESES_PT[parseInt(m)],
            value: Math.round((b.sum / b.n) * 100) / 100,
            ts: new Date(b.ts).toISOString(),
          }
        })
      return NextResponse.json<HistoriaResponse>({
        data, empty: false, modo,
        fonte: 'CEPEA · FOB Paranaguá (estimado)',
        unidade: 'R$/sc 60kg', moeda: 'BRL',
        observacao: 'Estimativa: spot CEPEA + prêmio FOB médio',
      })
    }

    // === B3 (futuros físicos brasileiros) — sem API gratuita
    if (modo === 'b3') {
      return NextResponse.json<HistoriaResponse>(
        emptyResp(modo, 'Integração B3 disponível no plano Enterprise', 'B3 · SFI/SOJ', 'R$/sc 60kg', 'BRL')
      )
    }

    // === CBOT (futuros Chicago via ETF Teucrium proxy) — Twelve Data
    if (modo === 'cbot') {
      const symbol = ETF_BY_GRAIN[grao] || 'SOYB'
      const periodo = dias <= 35 ? '1m' : dias <= 200 ? '6m' : '1a'
      const points = await fetchHistorico(symbol, periodo)
      if (!points.length) {
        return NextResponse.json<HistoriaResponse>(
          emptyResp(modo, 'Twelve Data temporariamente indisponível (rate limit)', `${symbol} · NYSE`, 'USD/cota', 'USD')
        )
      }
      // Sample para até ~24 pontos
      const SAMPLE = 24
      const step = Math.max(1, Math.floor(points.length / SAMPLE))
      const data: HistoriaResponse['data'] = []
      for (let i = 0; i < points.length; i += step) {
        const p = points[i]
        const d = new Date(p.datetime)
        data.push({
          label: MESES_PT[d.getMonth()],
          value: Math.round(p.close * 100) / 100,
          ts: p.datetime,
        })
      }
      return NextResponse.json<HistoriaResponse>({
        data, empty: false, modo,
        fonte: `${symbol} · NYSE (proxy CBOT)`,
        unidade: 'USD/cota',
        moeda: 'USD',
        ticker: symbol,
      })
    }

    return NextResponse.json(emptyResp('fisico', 'modo inválido', '', '', ''))
  } catch (e: any) {
    console.error('GET /cotacoes/historia error:', e)
    return NextResponse.json({ error: 'Erro', data: [], empty: true }, { status: 200 })
  }
}
