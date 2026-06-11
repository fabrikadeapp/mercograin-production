/**
 * app/api/intel/panorama/route.ts
 *
 * Endpoint que CONSOLIDA as 6 fontes de inteligência de mercado num único
 * "panorama" por grão:
 *   1. USDA PSD       — oferta & demanda (mundo + Brasil + Argentina + EUA).
 *   2. USDA ESR       — exportações semanais dos EUA.
 *   3. BCB Focus      — dólar projetado + curva de dólar futuro.
 *   4. CONAB          — safra brasileira (produção atual vs. anterior).
 *   5. BCB PTAX       — dólar à vista (presente).
 *   (a curva futura do Focus conta como a 6ª "fonte" de câmbio futuro.)
 *
 * GET ?grao=soja|milho&ano=2026
 *   - auth via getScope → 401 se sem sessão/workspace.
 *   - gating isFeatureEnabled(ws,'relatorios_usda') → 403.
 *   - busca TODAS as fontes em paralelo com Promise.allSettled: cada fonte é
 *     best-effort; a falha de uma NÃO derruba as outras (degradação graciosa).
 *   - consolida via montarPanorama() (lib pura) e carimba geradoEm.
 *
 * Resposta JSON:
 *   { grao, panorama, fontesOk: string[], fontesFalha: string[], geradoEm }
 *
 * O endpoint SEMPRE responde 200 (mesmo com falhas internas): erros são
 * capturados e refletidos em fontesFalha — a tela nunca quebra. Cache HTTP
 * curto (s-maxage ~600s) já que as fontes são caras e mudam devagar.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import {
  buscarMundo,
  buscarPais,
  USDA_CODES,
  ATTR,
  PAIS,
  type PsdRegistro,
} from '@/lib/usda/psd-client'
import { resumoExportacao } from '@/lib/usda/esr-client'
import { dolarProjetado, curvaDolarFuturo } from '@/lib/quotes/focus-client'
import { producaoAtualVsAnterior } from '@/lib/quotes/conab-client'
import { fetchBcbDolar } from '@/lib/quotes/bcb'
import {
  montarPanorama,
  type Grao,
  type OfertaDemandaInput,
  type ExportacoesInput,
  type FocusInput,
  type ConabInput,
  type DolarPresenteInput,
  type DolarFuturoPonto,
  type PanoramaIntel,
} from '@/lib/intel/agregador'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const FEATURE = 'relatorios_usda' as const

// ── Validação dos query params ──────────────────────────────────────────────

const querySchema = z.object({
  grao: z.enum(['soja', 'milho']).default('soja'),
  ano: z.coerce.number().int().min(2000).max(2100).optional(),
})

// ── Mapeamentos PSD ─────────────────────────────────────────────────────────

const CODE_POR_GRAO: Record<Grao, string> = {
  soja: USDA_CODES.soja,
  milho: USDA_CODES.milho,
}

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// ── Extração de valores PSD (mês mais recente x mês anterior) ────────────────

/**
 * Para uma métrica (attributeId) num marketYear, retorna o valor do mês mais
 * recente disponível (atual) e do mês imediatamente anterior. Soma por mês
 * quando há múltiplos países (Brasil + Argentina no mesmo month).
 * Valores PSD vêm em "mil unidades" (1000 MT) → dividimos por 1000 para Mt.
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

  const somaPorMes = new Map<number, number>()
  for (const r of daMetrica) {
    somaPorMes.set(r.month, (somaPorMes.get(r.month) ?? 0) + r.value)
  }

  const meses = [...somaPorMes.keys()].sort((a, b) => a - b)
  const mesAtual = meses[meses.length - 1]
  const atual = somaPorMes.get(mesAtual) ?? null
  const mesAnterior = meses[meses.length - 2]
  const anterior = mesAnterior !== undefined ? somaPorMes.get(mesAnterior) ?? null : null

  return { atual, anterior }
}

/** Converte mil-toneladas (PSD) para milhões de toneladas (Mt). null preserva. */
function paraMt(v: number | null): number | null {
  return v === null ? null : v / 1000
}

/**
 * Constrói o bloco de oferta & demanda do agregador a partir dos registros PSD
 * de uma seção (já agregados — mundo, ou BR+AR somados). Produtividade vem em
 * unidade própria (não converter pra Mt), por isso é tratada à parte.
 */
function montarOfertaDemanda(
  registros: PsdRegistro[],
  ano: number,
  referencia: string,
): OfertaDemandaInput | null {
  if (registros.length === 0) return null

  const estoque = valoresPorMes(registros, ATTR.estoqueFinal, ano)
  const producao = valoresPorMes(registros, ATTR.producao, ano)
  const produtiv = valoresPorMes(registros, ATTR.produtividade, ano)

  const temAlgum =
    estoque.atual !== null || producao.atual !== null || produtiv.atual !== null
  if (!temAlgum) return null

  return {
    referencia,
    estoqueFinal:
      estoque.atual !== null
        ? { atual: paraMt(estoque.atual), anterior: paraMt(estoque.anterior), unidade: 'Mt' }
        : undefined,
    producao:
      producao.atual !== null
        ? { atual: paraMt(producao.atual), anterior: paraMt(producao.anterior), unidade: 'Mt' }
        : undefined,
    // Produtividade não é massa — mantém a unidade própria do PSD (t/ha-ish).
    produtividade:
      produtiv.atual !== null
        ? { atual: produtiv.atual, anterior: produtiv.anterior, unidade: 't/ha' }
        : undefined,
  }
}

/**
 * Busca PSD (mundo + Brasil + Argentina + EUA) para o ano corrente e o
 * anterior (o "anterior" do agregador é o WASDE prévio, derivado em valoresPorMes
 * via meses). Retorna os registros já concatenados (a soma por mês acontece na
 * extração). psd-client nunca lança.
 */
async function buscarPsd(code: string, ano: number): Promise<PsdRegistro[]> {
  const [mundo, br, ar, eua] = await Promise.all([
    buscarMundo(code, ano),
    buscarPais(code, PAIS.brasil, ano),
    buscarPais(code, PAIS.argentina, ano),
    buscarPais(code, PAIS.eua, ano),
  ])
  return [...mundo, ...br, ...ar, ...eua]
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    // 1. Auth.
    const scope = await getScope(searchParams)
    if (!scope || !scope.workspaceId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // 2. Gating por plano.
    const liberado = await isFeatureEnabled(scope.workspaceId, FEATURE)
    if (!liberado) {
      return NextResponse.json({ error: 'feature_disabled' }, { status: 403 })
    }

    // 3. Query params.
    const parsed = querySchema.safeParse({
      grao: searchParams.get('grao') ?? undefined,
      ano: searchParams.get('ano') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid', detalhes: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const grao = parsed.data.grao
    const ano = parsed.data.ano ?? new Date().getFullYear()
    const code = CODE_POR_GRAO[grao]
    const produtoConab = grao === 'soja' ? ('SOJA' as const) : ('MILHO' as const)
    const referencia = `${MESES_PT[new Date().getMonth()] ?? ''} ${ano}`.trim()

    const fontesOk: string[] = []
    const fontesFalha: string[] = []

    // 4. Busca TODAS as fontes em paralelo (best-effort, isoladas).
    const [
      psdRes,
      esrRes,
      focusProjRes,
      focusCurvaRes,
      conabRes,
      bcbRes,
    ] = await Promise.allSettled([
      buscarPsd(code, ano),
      resumoExportacao(grao, ano),
      dolarProjetado(),
      curvaDolarFuturo(),
      producaoAtualVsAnterior(produtoConab),
      fetchBcbDolar(),
    ])

    // ── USDA PSD → oferta & demanda ──
    let ofertaDemanda: OfertaDemandaInput | null = null
    if (psdRes.status === 'fulfilled') {
      ofertaDemanda = montarOfertaDemanda(psdRes.value, ano, referencia)
      if (ofertaDemanda) fontesOk.push('USDA PSD')
      else fontesFalha.push('USDA PSD')
    } else {
      fontesFalha.push('USDA PSD')
    }

    // ── USDA ESR → exportações ──
    let exportacoes: ExportacoesInput | null = null
    if (esrRes.status === 'fulfilled' && esrRes.value) {
      const r = esrRes.value
      if (r.vendasSemana !== null || r.commitmentTotal !== null) {
        exportacoes = {
          marketYear: ano,
          vendasSemana: r.vendasSemana,
          acumulado: r.commitmentTotal,
          emCarteira: null,
          unidade: 'mil t',
        }
        fontesOk.push('USDA ESR')
      } else {
        fontesFalha.push('USDA ESR')
      }
    } else {
      fontesFalha.push('USDA ESR')
    }

    // ── BCB Focus → dólar projetado ──
    let focus: FocusInput | null = null
    if (focusProjRes.status === 'fulfilled' && focusProjRes.value) {
      const proj = focusProjRes.value
      // Preferimos a projeção de fim de ano; cai pro próximo mês se faltar.
      const ponto = proj.fimAno ?? proj.proximoMes
      if (ponto) {
        focus = {
          cambio: {
            dataReferencia: ponto.mesReferencia,
            mediana: ponto.mediana,
            media: ponto.media,
          },
        }
        fontesOk.push('BCB Focus')
      } else {
        fontesFalha.push('BCB Focus')
      }
    } else {
      fontesFalha.push('BCB Focus')
    }

    // ── BCB Focus → curva de dólar futuro ──
    let dolarFuturo: DolarFuturoPonto[] | null = null
    if (focusCurvaRes.status === 'fulfilled' && focusCurvaRes.value.length > 0) {
      dolarFuturo = focusCurvaRes.value.map((p) => ({
        mesRef: p.mesReferencia,
        mediana: p.mediana,
        media: p.media,
        min: p.minimo,
        max: p.maximo,
      }))
      fontesOk.push('Dólar Futuro (Focus)')
    } else {
      fontesFalha.push('Dólar Futuro (Focus)')
    }

    // ── CONAB → safra brasileira ──
    let conab: ConabInput | null = null
    if (conabRes.status === 'fulfilled' && conabRes.value && conabRes.value.atual) {
      const c = conabRes.value
      conab = {
        safra: c.atual!.anoAgricola,
        // CONAB devolve produção em MIL toneladas → converte pra Mt.
        producaoMt: paraMt(c.atual!.producaoMilT),
        producaoMtAnterior: c.anterior ? paraMt(c.anterior.producaoMilT) : null,
        areaMilhaoHa: c.atual!.areaMilHa / 1000,
        // produtividade vem em mil t / mil ha (= t/ha) → kg/ha p/ exibição.
        produtividade: c.atual!.produtividade * 1000,
      }
      fontesOk.push('CONAB')
    } else {
      fontesFalha.push('CONAB')
    }

    // ── BCB PTAX → dólar à vista ──
    let dolarPresente: DolarPresenteInput | null = null
    if (bcbRes.status === 'fulfilled') {
      const d = bcbRes.value
      const valor = d.cotacaoVenda ?? d.cotacaoCompra
      if (valor !== null && valor !== undefined) {
        dolarPresente = { valor, fonte: 'BCB PTAX' }
        fontesOk.push('BCB PTAX')
      } else {
        fontesFalha.push('BCB PTAX')
      }
    } else {
      fontesFalha.push('BCB PTAX')
    }

    // 5. Consolida tudo na lib pura, carimbando geradoEm (servidor).
    const geradoEm = new Date().toISOString()
    const panorama: PanoramaIntel = montarPanorama({
      grao,
      geradoEm,
      ofertaDemanda,
      exportacoes,
      focus,
      conab,
      dolarPresente,
      dolarFuturo,
    })

    return NextResponse.json(
      { grao, panorama, fontesOk, fontesFalha, geradoEm },
      {
        headers: {
          // Cache curto: as fontes são caras e mudam devagar (WASDE mensal,
          // Focus semanal, CONAB mensal). 10min de borda + stale-while-revalidate.
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800',
        },
      },
    )
  } catch (err) {
    // Blindagem final: o endpoint NUNCA derruba a tela. Mesmo num erro
    // inesperado devolve 200 com um panorama vazio e a fonte marcada como falha.
    console.error('[intel/panorama] GET erro:', err)
    const geradoEm = new Date().toISOString()
    return NextResponse.json(
      {
        grao: 'soja',
        panorama: { grao: 'soja', geradoEm, fontes: [], sinais: [] },
        fontesOk: [],
        fontesFalha: ['erro_interno'],
        geradoEm,
      },
      { status: 200 },
    )
  }
}
