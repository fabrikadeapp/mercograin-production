/**
 * GET /api/cotacoes/historico-db?graos=soja,milho&periodo=30d&mm=9,21
 * Histórico avançado a partir da tabela Cotacao (cron diário).
 * Retorna dados em formato Recharts + resumos por grão.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import {
  carregarHistorico,
  paraRecharts,
  resumoSerie,
  type Grao,
  type Periodo,
} from '@/lib/cotacoes/historico'

export const dynamic = 'force-dynamic'

const schema = z.object({
  graos: z.array(z.enum(['soja', 'milho', 'trigo'])).min(1).default(['soja']),
  periodo: z.enum(['7d', '30d', '90d', '1y', 'all']).default('30d'),
  mediaMovel: z.array(z.number().int().positive().max(60)).optional(),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const parsed = schema.safeParse({
    graos: url.searchParams.get('graos')?.split(',') || ['soja'],
    periodo: url.searchParams.get('periodo') || '30d',
    mediaMovel:
      url.searchParams.get('mm')?.split(',').map(Number).filter(Number.isFinite) || undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad params' }, { status: 400 })
  }

  const { graos, periodo, mediaMovel } = parsed.data
  const series = await carregarHistorico(graos as Grao[], periodo as Periodo)
  const dados = paraRecharts(series, { mediaMovel })
  const resumos = Object.fromEntries(series.map((s) => [s.grao, resumoSerie(s.pontos)]))

  return NextResponse.json({
    dados,
    resumos,
    periodo,
    graos,
    mediaMovel: mediaMovel || [],
  })
}
