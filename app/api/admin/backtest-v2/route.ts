/**
 * GET /api/admin/backtest-v2  (SUPERADMIN)
 *
 * BACKTEST EXAUSTIVO. Reconstrói, para cada mês dos últimos ~5 anos, a série
 * mensal alinhada (preço físico gabarito + CBOT + câmbio + COT managed money +
 * carry sazonal estimado + mês calendário) e roda o GRID SEARCH WALK-FORWARD
 * (gridSearchWalkForward) sobre TODOS os subconjuntos de fatores acadêmicos ×
 * horizontes [1,2,3]. A métrica reportada é SEMPRE out-of-sample (treina
 * in-sample, mede no bloco seguinte) — evita overfit e mede a assertividade REAL.
 *
 * Fontes (best-effort, Promise.allSettled — nunca derruba o endpoint):
 *   - precoFisicoBR  → SÉRIE GABARITO (R$/saca60, IPEA/DERAL). Obrigatória.
 *   - cbotMensal     → tendência internacional (¢/bushel, Yahoo).
 *   - cambioMensal   → câmbio fim de mês (USD/BRL, BCB).
 *   - cotHistorico → agregarMensal → net managed money mensal (CFTC), z-score.
 *   - carrySazonalEstimado → carry típico por mês calendário (term-structure).
 *
 * Gating: getScope(searchParams); se !scope.isAdmin → 403.
 *
 * Resposta (sempre 200, exceto 401/403): {
 *   grao, melhor, ranking (top 15), totalCombos, pontos, fontesOk,
 *   baselineV1:{ taxaAcerto }, geradoEm
 * }
 * Se a série gabarito vier vazia → { erro: 'sem_serie_preco' } (NÃO inventa).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import {
  precoFisicoBR,
  cbotMensal,
  cambioMensal,
  alinharPorMes,
  type Grao,
  type PontoMensal,
} from '@/lib/historico/series-client'
import { cotHistorico, agregarMensal, zScoreNet } from '@/lib/historico/cot-client'
import { carrySazonalEstimado } from '@/lib/historico/termo-client'
import {
  gridSearchWalkForward,
  powerset,
  FATORES_V2,
  type PontoSerieV2,
} from '@/lib/backtest/engine-v2'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

const GRAOS_VALIDOS: Grao[] = ['soja', 'milho']

/**
 * Baseline V1 a superar (resultado documentado do backtest original): soja
 * ~50% de acerto. Exibido como referência do ganho do exaustivo.
 */
const BASELINE_V1_TAXA_ACERTO = 50

/** `Promise.allSettled` → valor cumprido ou fallback (best-effort). */
function ok<T>(r: PromiseSettledResult<T>, fallback: T): T {
  return r.status === 'fulfilled' ? r.value : fallback
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // ── Gating SUPERADMIN ───────────────────────────────────────────────────────
  const scope = await getScope(searchParams)
  if (!scope) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!scope.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // ── Parâmetros ──────────────────────────────────────────────────────────────
  const graoParam = (searchParams.get('grao') || 'soja').toLowerCase()
  const grao: Grao = GRAOS_VALIDOS.includes(graoParam as Grao)
    ? (graoParam as Grao)
    : 'soja'

  const geradoEm = new Date().toISOString()
  // MÁXIMO histórico disponível: preço físico IPEA vai a 1993, CBOT (Yahoo
  // range=max) e câmbio BCB a ~2000. A interseção dá ~25 anos — bem mais
  // robusto que 5 anos. O COT (CFTC) só tem managed money desde ~2006, então
  // entra apenas nos meses em que existe (fator opcional, não limita a série).
  const anoInicial = 2000

  try {
    // ── Busca paralela best-effort ────────────────────────────────────────────
    const [rPreco, rCbot, rCambio, rCot] = await Promise.allSettled([
      precoFisicoBR(grao),
      cbotMensal(grao),
      cambioMensal(anoInicial),
      cotHistorico(grao, anoInicial),
    ])

    const precos = ok(rPreco, [] as PontoMensal[])
    const cbot = ok(rCbot, [] as PontoMensal[])
    const cambio = ok(rCambio, [] as PontoMensal[])
    const cotPontos = ok(rCot, [] as Awaited<ReturnType<typeof cotHistorico>>)

    // COT mensal (net managed money) → série de PontoMensal p/ alinhar por mês.
    const cotMensal = agregarMensal(cotPontos)
    const netSerie = cotMensal.map((c) => c.net)
    const zScores = zScoreNet(netSerie)
    const cotComoSerie: PontoMensal[] = cotMensal.map((c, i) => ({
      ano: c.ano,
      mes: c.mes,
      valor: zScores[i],
    }))

    const fontesOk = {
      precoFisico: precos.length > 0,
      cbot: cbot.length > 0,
      cambio: cambio.length > 0,
      cot: cotMensal.length > 0,
    }

    // Série gabarito é OBRIGATÓRIA — sem ela não há backtest possível.
    if (precos.length === 0) {
      return NextResponse.json(
        { erro: 'sem_serie_preco', grao, fontesOk, geradoEm },
        { status: 200 },
      )
    }

    // Recorta o gabarito para a janela de ~5 anos (asc por ano/mes).
    const precosJanela = precos.filter((p) => p.ano >= anoInicial)
    const baseGabarito = precosJanela.length > 0 ? precosJanela : precos

    // ── Alinha por mês: ordem das séries = [preço, cbot, câmbio, cotZScore] ────
    const linhas = alinharPorMes(baseGabarito, cbot, cambio, cotComoSerie)

    // Constrói a série V2 do motor: SÓ meses com preço físico (gabarito) válido,
    // anexando net COT (z-score), mês calendário e carry sazonal estimado.
    const serie: PontoSerieV2[] = []
    for (const l of linhas) {
      const precoFisico = l.valores[0]
      if (precoFisico === null || !Number.isFinite(precoFisico)) continue
      const cbotV = l.valores[1]
      const cambioV = l.valores[2]
      const cotZ = l.valores[3]
      const mes = `${l.ano}-${String(l.mes).padStart(2, '0')}`
      serie.push({
        mes,
        precoFisico,
        cbot: cbotV !== null && Number.isFinite(cbotV) ? cbotV : 0,
        cambio: cambioV !== null && Number.isFinite(cambioV) ? cambioV : 0,
        mesCalendario: l.mes,
        cotZScore: cotZ !== null && Number.isFinite(cotZ) ? cotZ : undefined,
        carryPct: carrySazonalEstimado(l.mes, grao),
      })
    }

    if (serie.length < 6) {
      return NextResponse.json(
        { erro: 'serie_insuficiente', grao, fontesOk, pontos: serie.length, geradoEm },
        { status: 200 },
      )
    }

    // ── Grid search EXAUSTIVO walk-forward ────────────────────────────────────
    // Powerset dos 6 fatores acadêmicos (63 combos) × horizontes [1,2,3].
    // janelaTreino ≈ metade da série (anchored walk-forward; mín. 12 meses).
    const combos = powerset([...FATORES_V2])
    const janelaTreino = Math.max(12, Math.floor(serie.length / 2))

    const resultado = gridSearchWalkForward(serie, {
      horizontes: [1, 2, 3],
      combosFatores: combos,
      janelaTreino,
    })

    return NextResponse.json(
      {
        grao,
        melhor: resultado.melhor,
        ranking: resultado.ranking.slice(0, 15),
        totalCombos: resultado.totalCombos,
        pontos: serie.length,
        fontesOk,
        baselineV1: { taxaAcerto: BASELINE_V1_TAXA_ACERTO },
        geradoEm,
      },
      { status: 200 },
    )
  } catch (e: any) {
    // Nunca derruba o endpoint: devolve 200 com o erro registrado.
    console.warn('[admin/backtest-v2] falhou:', e?.message || e)
    return NextResponse.json(
      {
        erro: 'falha_inesperada',
        detalhe: String(e?.message || e),
        grao,
        geradoEm,
      },
      { status: 200 },
    )
  }
}
