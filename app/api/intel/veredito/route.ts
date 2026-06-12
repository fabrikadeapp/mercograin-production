/**
 * app/api/intel/veredito/route.ts
 *
 * O endpoint do CORAÇÃO do BH Intelligence: o VEREDITO ao vivo de um grão a
 * partir dos 3 sinais independentes (sazonal · mean-reversion · momentum) e do
 * voto majoritário entre eles — TODOS com sua taxa histórica real comprovada em
 * ~25 anos. Posicionamento honesto: o teto da DIREÇÃO é ~55-60%; o edge é
 * modesto (+5 a +6pp sobre o acaso) mas consistente e auditável. NÃO inventa
 * "75% de acerto" nem "previsão garantida".
 *
 * GET ?grao=soja|milho&horizonte=2
 *   - auth via getScope → 401 se sem sessão/workspace.
 *   - gating isFeatureEnabled(ws,'relatorios_usda') → 403.
 *   - busca o preço físico BR (gabarito, R$/saca, IPEA) + o CBOT mensal (¢/bu,
 *     Yahoo) em paralelo com Promise.allSettled (best-effort, isoladas).
 *   - alinha as duas séries por mês via alinharPorMes → PontoVeredito[] (~25
 *     anos), onde o preço físico é o gabarito e o CBOT alimenta o momentum.
 *   - vereditoAoVivo(serie, H) → o veredito do mês corrente com os 3 sinais e
 *     suas taxas históricas reais; avaliarHistorico(serie, H) → a performance
 *     comprovada que a tela exibe como prova.
 *
 * Resposta JSON:
 *   { grao, veredito, historico, mesesAnalisados, geradoEm, fontesOk }
 *
 * O endpoint SEMPRE responde 200 (mesmo com falha interna). Se a série de preço
 * físico (gabarito) não carregar, devolve { erro: 'sem_dados' } HONESTO — NÃO
 * inventa um veredito sem dado real. Cache HTTP curto (s-maxage ~600s): as
 * séries são mensais e mudam devagar.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import {
  precoFisicoBR,
  cbotMensal,
  alinharPorMes,
  type Grao,
  type PontoMensal,
} from '@/lib/historico/series-client'
import {
  vereditoAoVivo,
  avaliarHistorico,
  HORIZONTE_PADRAO,
  type PontoVeredito,
} from '@/lib/veredito/sinais'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const FEATURE = 'relatorios_usda' as const

// ── Validação dos query params ──────────────────────────────────────────────

const querySchema = z.object({
  grao: z.enum(['soja', 'milho']).default('soja'),
  horizonte: z.coerce.number().int().min(1).max(12).default(HORIZONTE_PADRAO),
})

// ── Montagem da série PontoVeredito[] (pura) ────────────────────────────────

/**
 * Alinha preço físico (gabarito) + CBOT por mês numa série PontoVeredito[]
 * ascendente. O preço físico é OBRIGATÓRIO (gabarito); meses sem físico são
 * descartados. O CBOT pode faltar num mês → vira NaN (o momentum trata como
 * indisponível e fica neutro, sem quebrar). FUNÇÃO PURA.
 */
function montarSerie(fisico: PontoMensal[], cbot: PontoMensal[]): PontoVeredito[] {
  const linhas = alinharPorMes(fisico, cbot) // [0]=físico, [1]=cbot
  const serie: PontoVeredito[] = []
  for (const l of linhas) {
    const preco = l.valores[0]
    if (preco === null || !Number.isFinite(preco)) continue // sem gabarito → fora
    const cbotMes = l.valores[1]
    serie.push({
      ano: l.ano,
      mes: l.mes,
      preco,
      cbot: cbotMes !== null && Number.isFinite(cbotMes) ? cbotMes : NaN,
    })
  }
  return serie
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
      horizonte: searchParams.get('horizonte') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid', detalhes: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const grao: Grao = parsed.data.grao
    const H = parsed.data.horizonte

    // 4. Busca as duas séries em paralelo (best-effort, isoladas).
    const [fisicoRes, cbotRes] = await Promise.allSettled([
      precoFisicoBR(grao),
      cbotMensal(grao),
    ])

    const fisico = fisicoRes.status === 'fulfilled' ? fisicoRes.value : []
    const cbot = cbotRes.status === 'fulfilled' ? cbotRes.value : []

    const fontesOk: string[] = []
    if (fisico.length > 0) fontesOk.push('Preço Físico BR (IPEA)')
    if (cbot.length > 0) fontesOk.push('CBOT (Yahoo)')

    // 5. Sem o gabarito (preço físico) não há veredito honesto possível.
    const serie = montarSerie(fisico, cbot)
    if (serie.length === 0) {
      const geradoEm = new Date().toISOString()
      return NextResponse.json(
        { grao, erro: 'sem_dados', mesesAnalisados: 0, geradoEm, fontesOk },
        { status: 200 },
      )
    }

    // 6. Veredito ao vivo + performance histórica comprovada (libs puras).
    //    Passa o grão para ativar a janela sazonal de alta convicção
    //    (calibração validada em 25 anos: soja jun-ago ~69%, milho ~61%).
    const veredito = vereditoAoVivo(serie, H, grao)
    const historico = avaliarHistorico(serie, H)
    const geradoEm = new Date().toISOString()

    return NextResponse.json(
      {
        grao,
        veredito,
        historico,
        mesesAnalisados: serie.length,
        geradoEm,
        fontesOk,
      },
      {
        headers: {
          // Séries mensais (IPEA/Yahoo) mudam devagar: 10min de borda +
          // stale-while-revalidate generoso.
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800',
        },
      },
    )
  } catch (err) {
    // Blindagem final: o endpoint NUNCA derruba a tela. Em erro inesperado
    // devolve 200 com { erro } honesto — sem inventar um veredito.
    console.error('[intel/veredito] GET erro:', err)
    const geradoEm = new Date().toISOString()
    return NextResponse.json(
      { grao: 'soja', erro: 'sem_dados', mesesAnalisados: 0, geradoEm, fontesOk: [] },
      { status: 200 },
    )
  }
}
