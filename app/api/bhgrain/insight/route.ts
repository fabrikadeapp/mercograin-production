/**
 * GET /api/bhgrain/insight
 *
 * Gera o "InsightBar" dinâmico do dashboard BH Grain.
 *
 * Lógica:
 *  1. Identifica a commodity com maior variação % no dia (changePct via Yahoo).
 *  2. Conta propostas em status aberto cujo JSON `graos` inclui aquela commodity.
 *  3. Lista até 3 nomes de clientes com proposta aberta naquela commodity.
 *
 * Se não houver dado relevante, retorna { show: false }.
 */

import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { requireScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { getQuotesBatch } from '@/lib/commodities/yahoo-batch'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const FUTUROS = {
  soja: 'ZS=F',
  milho: 'ZC=F',
  trigo: 'ZW=F',
} as const

const COMMODITY_PT: Record<keyof typeof FUTUROS, string> = {
  soja: 'Soja',
  milho: 'Milho',
  trigo: 'Trigo',
}

const STATUS_ABERTAS = ['rascunho', 'enviada', 'em_negociacao', 'em negociação']
const MIN_VARIACAO_PCT = 0.15

interface PropostaGrao {
  grao?: string
  quantidade?: number
  unidade?: string
}

/**
 * Cache 120s das propostas abertas por workspace. Invalidado por revalidateTag('propostas')
 * quando POST/PATCH/DELETE de proposta acontece (best-effort).
 */
const getPropostasAbertasCached = unstable_cache(
  async (workspaceId: string) => {
    return db.proposta
      .findMany({
        where: {
          workspaceId,
          status: { in: STATUS_ABERTAS },
        },
        select: {
          id: true,
          graos: true,
          cliente: { select: { nome: true } },
        },
        take: 200,
        orderBy: { atualizadaEm: 'desc' },
      })
      .catch(
        () =>
          [] as Array<{
            id: string
            graos: unknown
            cliente: { nome: string } | null
          }>,
      )
  },
  ['propostas-abertas-insight'],
  {
    revalidate: 120,
    tags: ['propostas'],
  },
)

export async function GET() {
  try {
    const scope = await requireScope()

    // 1. Variação do dia por commodity (via Yahoo)
    const quotes = await getQuotesBatch(Object.values(FUTUROS) as unknown as string[]).catch(
      () => ({}) as Record<string, { changePct?: number | null }>
    )

    let topVariacao: { commodity: keyof typeof FUTUROS; pct: number } | null = null
    for (const [key, ticker] of Object.entries(FUTUROS) as [keyof typeof FUTUROS, string][]) {
      const q = quotes[ticker]
      const pct = q?.changePct
      if (typeof pct !== 'number' || !Number.isFinite(pct)) continue
      if (!topVariacao || Math.abs(pct) > Math.abs(topVariacao.pct)) {
        topVariacao = { commodity: key, pct }
      }
    }

    // 2. Propostas em aberto desse workspace (cache 120s por workspace).
    const propostasAbertas = await getPropostasAbertasCached(scope.workspaceId)

    // Fallback: se não houve variação relevante OU não conseguimos cotação,
    // mas há propostas em rascunho, ainda mostramos um insight "geral" — para
    // o dashboard não ficar vazio (e seguir o mockup do design).
    const totalRascunho = propostasAbertas.length

    if (!topVariacao || Math.abs(topVariacao.pct) < MIN_VARIACAO_PCT) {
      if (totalRascunho === 0) return NextResponse.json({ show: false })
      // Fallback estável quando não há variação significativa
      const nomesAll = Array.from(
        new Set(propostasAbertas.map((p) => p.cliente?.nome).filter(Boolean) as string[])
      ).slice(0, 3)
      const nomesText =
        nomesAll.length === 0
          ? ''
          : nomesAll.length === 1
            ? nomesAll[0]
            : nomesAll.length === 2
              ? `${nomesAll[0]} e ${nomesAll[1]}`
              : `${nomesAll[0]}, ${nomesAll[1]} e ${nomesAll[2]}`
      return NextResponse.json({
        show: true,
        title: `${totalRascunho} ${totalRascunho === 1 ? 'proposta em aberto pode' : 'propostas em aberto podem'} ser priorizada${totalRascunho === 1 ? '' : 's'}`,
        description: nomesText
          ? `${nomesText}${nomesAll.length < propostasAbertas.length ? ' e outros' : ''} aguardam follow-up`
          : 'Revise propostas em rascunho antes de fechar o dia',
        commodity: null,
        variacaoPct: null,
        propostasCount: totalRascunho,
        propostaIds: propostasAbertas.slice(0, 10).map((p) => p.id),
      })
    }

    const matched = propostasAbertas.filter((p) => {
      const graos = p.graos as PropostaGrao[] | null
      if (!Array.isArray(graos)) return false
      return graos.some((g) => (g?.grao ?? '').toLowerCase() === topVariacao!.commodity)
    })

    if (matched.length === 0) {
      // Tem variação mas nenhuma proposta na commodity afetada — ainda assim
      // vale comunicar para o operador (para abrir nova oportunidade).
      const commodityNome = COMMODITY_PT[topVariacao.commodity]
      const subiu = topVariacao.pct > 0
      const pctFmt = Math.abs(topVariacao.pct).toFixed(2).replace('.', ',')
      return NextResponse.json({
        show: true,
        title: `${commodityNome} ${subiu ? 'subiu' : 'caiu'} ${pctFmt}% hoje`,
        description: `Sem propostas em aberto de ${commodityNome.toLowerCase()} — pode ser oportunidade de prospecção`,
        commodity: topVariacao.commodity,
        variacaoPct: topVariacao.pct,
        propostasCount: 0,
        propostaIds: [],
      })
    }

    // 3. Nomes únicos (até 3)
    const nomes = Array.from(
      new Set(matched.map((p) => p.cliente?.nome).filter(Boolean) as string[])
    ).slice(0, 3)

    const nomesText =
      nomes.length === 0
        ? ''
        : nomes.length === 1
          ? nomes[0]
          : nomes.length === 2
            ? `${nomes[0]} e ${nomes[1]}`
            : `${nomes[0]}, ${nomes[1]} e ${nomes[2]}`

    const commodityNome = COMMODITY_PT[topVariacao.commodity]
    const subiu = topVariacao.pct > 0
    const pctFmt = Math.abs(topVariacao.pct).toFixed(2).replace('.', ',')

    const title = `${commodityNome} ${subiu ? 'subiu' : 'caiu'} ${pctFmt}% hoje — ${matched.length} ${matched.length === 1 ? 'proposta em aberto pode' : 'propostas em aberto podem'} ser ${matched.length === 1 ? 'priorizada' : 'priorizadas'}`
    const description = nomesText
      ? `${nomesText}${nomes.length < matched.length ? ' e outros' : ''} têm cotação de ${commodityNome.toLowerCase()} em aberto`
      : `${matched.length} clientes têm cotação de ${commodityNome.toLowerCase()} em aberto`

    return NextResponse.json({
      show: true,
      title,
      description,
      commodity: topVariacao.commodity,
      variacaoPct: topVariacao.pct,
      propostasCount: matched.length,
      propostaIds: matched.slice(0, 10).map((p) => p.id),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const status = msg === 'Não autorizado' ? 401 : 500
    return NextResponse.json({ error: msg, show: false }, { status })
  }
}
