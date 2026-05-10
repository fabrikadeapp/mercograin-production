import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import {
  varParametrico,
  varHistorico,
  varMonteCarlo,
  stressTest,
  type VaRInput,
  type ChoqueStress,
  type Cultura,
} from '@/lib/risco/var'

const BUSHELS_POR_CONTRATO = 5000

/**
 * POST /api/risco/var
 * Body: { metodo?: 'parametrico'|'historico'|'monte_carlo'|'todos', confianca?, horizonte?, simulacoes?, choques? }
 * Calcula VaR sobre as posições abertas do workspace usando histórico de Cotacao + TaxaCambio (90d).
 */
export async function POST(req: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const metodo: 'parametrico' | 'historico' | 'monte_carlo' | 'todos' =
    body?.metodo || 'todos'
  const confianca = body?.confianca === 0.99 ? 0.99 : 0.95
  const horizonte = Math.max(1, Math.min(30, Number(body?.horizonte ?? 1)))
  const simulacoes = Math.max(100, Math.min(10000, Number(body?.simulacoes ?? 1000)))
  const choques: ChoqueStress[] = Array.isArray(body?.choques) ? body.choques : []

  // Câmbio atual
  const tx = await db.taxaCambio.findFirst({
    where: { origem: 'USD', destino: 'BRL' },
    orderBy: { data: 'desc' },
  })
  const cambioAtualUsdBrl = tx ? Number(tx.taxa) : 5.0

  // Posições abertas
  const pos = await db.posicaoHedge.findMany({
    where: { workspaceId: scope.workspaceId, status: 'aberta' },
  })
  const posicoes = pos
    .filter((p) => p.cultura && p.precoEntradaUsdBu)
    .map((p) => {
      const valor = Number(p.precoEntradaUsdBu) * Number(p.qtdContratos) * BUSHELS_POR_CONTRATO
      return {
        valorAtualUSD: valor,
        cultura: p.cultura as Cultura,
        tipo: p.tipo as 'long' | 'short',
      }
    })

  if (posicoes.length === 0) {
    return NextResponse.json({ aviso: 'sem_posicoes_abertas', resultados: [] })
  }

  // Histórico — últimos 90 dias
  const desde = new Date(Date.now() - 90 * 86400000)
  const [cotSoja, cotMilho, cotTrigo, cambioHist] = await Promise.all([
    db.cotacao.findMany({
      where: { grao: 'soja', data: { gte: desde } },
      orderBy: { data: 'asc' },
    }),
    db.cotacao.findMany({
      where: { grao: 'milho', data: { gte: desde } },
      orderBy: { data: 'asc' },
    }),
    db.cotacao.findMany({
      where: { grao: 'trigo', data: { gte: desde } },
      orderBy: { data: 'asc' },
    }),
    db.taxaCambio.findMany({
      where: { origem: 'USD', destino: 'BRL', data: { gte: desde } },
      orderBy: { data: 'asc' },
    }),
  ])

  // Indexa por dia
  function key(d: Date): string {
    return d.toISOString().slice(0, 10)
  }
  const byDay: Map<string, { data: Date; soja?: number; milho?: number; trigo?: number; cambio?: number }> = new Map()
  for (const c of cotSoja) {
    const k = key(c.data)
    const cur = byDay.get(k) || { data: c.data }
    cur.soja = Number(c.preco)
    byDay.set(k, cur)
  }
  for (const c of cotMilho) {
    const k = key(c.data)
    const cur = byDay.get(k) || { data: c.data }
    cur.milho = Number(c.preco)
    byDay.set(k, cur)
  }
  for (const c of cotTrigo) {
    const k = key(c.data)
    const cur = byDay.get(k) || { data: c.data }
    cur.trigo = Number(c.preco)
    byDay.set(k, cur)
  }
  for (const c of cambioHist) {
    const k = key(c.data)
    const cur = byDay.get(k) || { data: c.data }
    cur.cambio = Number(c.taxa)
    byDay.set(k, cur)
  }
  const historico = Array.from(byDay.values()).sort(
    (a, b) => a.data.getTime() - b.data.getTime(),
  )

  const input: VaRInput = {
    posicoes,
    cambioAtualUsdBrl,
    historico,
    confianca: confianca as 0.95 | 0.99,
    horizonte,
  }

  const resultados: any[] = []
  if (metodo === 'parametrico' || metodo === 'todos')
    resultados.push(varParametrico(input))
  if (metodo === 'historico' || metodo === 'todos')
    resultados.push(varHistorico(input))
  if (metodo === 'monte_carlo' || metodo === 'todos')
    resultados.push(varMonteCarlo(input, simulacoes))

  const stress = choques.length > 0 ? stressTest(input, choques) : null

  return NextResponse.json({
    cambioAtualUsdBrl,
    populacaoHistorico: historico.length,
    posicoes: posicoes.length,
    resultados,
    stress,
  })
}
