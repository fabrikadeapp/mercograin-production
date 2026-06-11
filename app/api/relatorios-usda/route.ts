/**
 * app/api/relatorios-usda/route.ts
 *
 * Geração e listagem de relatórios "USDA Projeções" (WASDE/PSD).
 *
 * POST → gera um relatório a partir dos dados do USDA PSD (mundo + países
 *        conforme as seções pedidas), monta a estrutura via montarRelatorio e
 *        PERSISTE um snapshot em RelatorioUsda. Se a chave da API não estiver
 *        presente ou o fetch falhar (sem dados úteis), cai no relatorioExemplo
 *        e marca origem:'exemplo'. Nunca trava — degradação graciosa.
 * GET  → lista os últimos 20 relatórios do workspace (ordem desc).
 *
 * Gating: feature 'relatorios_usda'. Multi-tenancy via getScope/whereOwn.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import { db } from '@/lib/db'
import {
  buscarMundo,
  buscarPais,
  temChave,
  USDA_CODES,
  ATTR,
  PAIS,
  type PsdRegistro,
} from '@/lib/usda/psd-client'
import {
  montarRelatorio,
  relatorioExemplo,
  type Grao,
  type Secao,
  type Metrica,
  type DadosRelatorio,
  type ValoresMetrica,
  type RelatorioUsda,
} from '@/lib/usda/relatorio'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const FEATURE = 'relatorios_usda' as const

// ── Validação do body ───────────────────────────────────────────────────────

const GRAOS = ['soja', 'milho'] as const
const SECOES = ['mundo', 'eua', 'brasil_argentina'] as const
const METRICAS = ['estoqueFinal', 'producao', 'produtividade'] as const

const bodySchema = z.object({
  graos: z.array(z.enum(GRAOS)).min(1),
  secoes: z.array(z.enum(SECOES)).min(1),
  metricas: z.array(z.enum(METRICAS)).min(1),
  ano: z.number().int().min(2000).max(2100).optional(),
})

// ── Mapeamentos PSD ─────────────────────────────────────────────────────────

const CODE_POR_GRAO: Record<Grao, string> = {
  soja: USDA_CODES.soja,
  milho: USDA_CODES.milho,
}

const ATTR_POR_METRICA: Record<Metrica, number> = {
  estoqueFinal: ATTR.estoqueFinal,
  producao: ATTR.producao,
  produtividade: ATTR.produtividade,
}

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// ── Extração de valores a partir dos registros PSD ──────────────────────────

/**
 * Filtra os registros de uma métrica (attributeId) num marketYear e retorna o
 * valor do mês mais recente disponível (atual) e do mês anterior a esse.
 * Soma os valores quando há múltiplos países (ex.: Brasil + Argentina).
 */
function valoresPorMes(
  registros: PsdRegistro[],
  attributeId: number,
  marketYear: number,
): { atual: number | null; anterior: number | null } {
  const daMetrica = registros.filter(
    (r) => r.attributeId === attributeId && r.marketYear === marketYear,
  )
  if (daMetrica.length === 0) return { atual: null, anterior: null }

  // Soma por mês (cobre o caso multi-país: BR + AR no mesmo month).
  const somaPorMes = new Map<number, number>()
  for (const r of daMetrica) {
    somaPorMes.set(r.month, (somaPorMes.get(r.month) ?? 0) + r.value)
  }

  const meses = [...somaPorMes.keys()].sort((a, b) => a - b)
  const mesAtual = meses[meses.length - 1]
  const atual = somaPorMes.get(mesAtual) ?? null

  // "anterior" = WASDE imediatamente anterior presente nos dados.
  const mesAnterior = meses[meses.length - 2]
  const anterior = mesAnterior !== undefined ? somaPorMes.get(mesAnterior) ?? null : null

  return { atual, anterior }
}

/**
 * Monta os ValoresMetrica (atual/anterior/safra passada, em mil-toneladas) de
 * uma métrica, dado o conjunto de registros e o ano corrente.
 * safraPassada = mês mais recente do marketYear-1.
 */
function montarValores(
  registros: PsdRegistro[],
  attributeId: number,
  ano: number,
): ValoresMetrica {
  const { atual, anterior } = valoresPorMes(registros, attributeId, ano)
  const { atual: safraPassadaMt } = valoresPorMes(registros, attributeId, ano - 1)
  return { atualMt: atual, anteriorMt: anterior, safraPassadaMt }
}

/** Indica se um ValoresMetrica tem ao menos o valor atual presente. */
function temDado(v: ValoresMetrica): boolean {
  return v.atualMt !== null
}

// ── Busca dos registros por seção ───────────────────────────────────────────

/**
 * Busca os registros PSD necessários para uma seção (mundo, EUA ou
 * Brasil+Argentina) de um grão, cobrindo o ano corrente e o anterior (para a
 * variação anual). Retorna [] em qualquer falha (psd-client nunca lança).
 */
async function buscarRegistrosSecao(
  code: string,
  secao: Secao,
  ano: number,
): Promise<PsdRegistro[]> {
  if (secao === 'mundo') {
    const [atual, passado] = await Promise.all([
      buscarMundo(code, ano),
      buscarMundo(code, ano - 1),
    ])
    return [...atual, ...passado]
  }

  if (secao === 'eua') {
    const [atual, passado] = await Promise.all([
      buscarPais(code, PAIS.eua, ano),
      buscarPais(code, PAIS.eua, ano - 1),
    ])
    return [...atual, ...passado]
  }

  // brasil_argentina: soma BR + AR (a soma por mês acontece em valoresPorMes).
  const [brAtual, brPassado, arAtual, arPassado] = await Promise.all([
    buscarPais(code, PAIS.brasil, ano),
    buscarPais(code, PAIS.brasil, ano - 1),
    buscarPais(code, PAIS.argentina, ano),
    buscarPais(code, PAIS.argentina, ano - 1),
  ])
  return [...brAtual, ...brPassado, ...arAtual, ...arPassado]
}

/**
 * Constrói o DadosRelatorio (dados[grao][secao][metrica]) buscando da API USDA.
 * Retorna { dados, comDado } onde comDado indica se algum valor real foi obtido
 * — se for false, o caller deve cair no relatório de exemplo.
 */
async function construirDados(
  graos: Grao[],
  secoes: Secao[],
  metricas: Metrica[],
  ano: number,
): Promise<{ dados: DadosRelatorio; comDado: boolean }> {
  const dados: DadosRelatorio = {}
  let comDado = false

  for (const grao of graos) {
    const code = CODE_POR_GRAO[grao]
    const dadosGrao: NonNullable<DadosRelatorio[Grao]> = {}

    for (const secao of secoes) {
      const registros = await buscarRegistrosSecao(code, secao, ano)
      if (registros.length === 0) continue

      const dadosSecao: Partial<Record<Metrica, ValoresMetrica>> = {}
      for (const metrica of metricas) {
        const valores = montarValores(registros, ATTR_POR_METRICA[metrica], ano)
        if (!temDado(valores)) continue
        dadosSecao[metrica] = valores
        comDado = true
      }

      if (Object.keys(dadosSecao).length > 0) {
        dadosGrao[secao] = dadosSecao
      }
    }

    if (Object.keys(dadosGrao).length > 0) {
      dados[grao] = dadosGrao
    }
  }

  return { dados, comDado }
}

// ── POST: gera + persiste ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope || !scope.workspaceId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const liberado = await isFeatureEnabled(scope.workspaceId, FEATURE)
    if (!liberado) {
      return NextResponse.json({ error: 'feature_disabled' }, { status: 403 })
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid', detalhes: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { graos, secoes, metricas } = parsed.data
    const ano = parsed.data.ano ?? new Date().getFullYear()
    const geradoEm = new Date().toISOString()

    let relatorio: RelatorioUsda
    let origem: 'usda' | 'exemplo'

    if (!temChave()) {
      // Sem chave de API — preview com exemplo.
      relatorio = relatorioExemplo(geradoEm)
      origem = 'exemplo'
    } else {
      let dados: DadosRelatorio = {}
      let comDado = false
      try {
        const r = await construirDados(graos, secoes, metricas, ano)
        dados = r.dados
        comDado = r.comDado
      } catch (err) {
        // psd-client não lança, mas blindamos por garantia.
        console.warn('[relatorios-usda] falha ao construir dados USDA:', err)
      }

      if (comDado) {
        const mes = MESES_PT[new Date().getMonth()] ?? ''
        relatorio = montarRelatorio({
          graos,
          secoes,
          metricas,
          dados,
          mesReferencia: `${mes} ${ano}`.trim(),
          geradoEm,
          titulo: 'USDA Projeções — Soja e Milho',
        })
        origem = 'usda'

        // Se nenhuma seção sobreviveu, ainda assim cai no exemplo (defensivo).
        if (relatorio.secoes.length === 0) {
          relatorio = relatorioExemplo(geradoEm)
          origem = 'exemplo'
        }
      } else {
        relatorio = relatorioExemplo(geradoEm)
        origem = 'exemplo'
      }
    }

    // Persiste o snapshot.
    const registro = await db.relatorioUsda.create({
      data: {
        workspaceId: scope.workspaceId,
        titulo: relatorio.titulo,
        mesReferencia: relatorio.mesReferencia,
        config: { graos, secoes, metricas, ano, origem },
        dados: relatorio as unknown as object,
        geradoPor: scope.userId || null,
      },
      select: { id: true },
    })

    return NextResponse.json({ id: registro.id, relatorio, origem })
  } catch (err) {
    console.error('[relatorios-usda] POST erro:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}

// ── GET: lista ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const scope = await getScope(searchParams)
    if (!scope || !scope.workspaceId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const liberado = await isFeatureEnabled(scope.workspaceId, FEATURE)
    if (!liberado) {
      return NextResponse.json({ error: 'feature_disabled' }, { status: 403 })
    }

    const relatorios = await db.relatorioUsda.findMany({
      where: scope.whereOwn(),
      orderBy: { geradoEm: 'desc' },
      take: 20,
      select: {
        id: true,
        titulo: true,
        mesReferencia: true,
        config: true,
        geradoPor: true,
        geradoEm: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ ok: true, relatorios })
  } catch (err) {
    console.error('[relatorios-usda] GET erro:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
