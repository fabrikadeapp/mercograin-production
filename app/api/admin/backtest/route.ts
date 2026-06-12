/**
 * GET /api/admin/backtest  (SUPERADMIN)
 *
 * Roda o backtest da inteligência de mercado com DADOS REAIS, reconstruindo,
 * para cada mês dos últimos ~N anos, o sinal que a inteligência teria dado com
 * a informação disponível ATÉ aquele mês, e comparando com o que o preço físico
 * (IPEA/DERAL — gabarito) fez nos H meses seguintes.
 *
 * Fontes (todas best-effort, buscadas em paralelo com Promise.allSettled):
 *   - precoFisicoBR  → SÉRIE GABARITO (R$/saca60). Se falhar → erro claro.
 *   - cbotMensal     → tendência internacional (¢/bushel).
 *   - cambioMensal   → câmbio à vista fim de mês (USD/BRL).
 *   - Focus histórico (expectativaMensal 'Câmbio') → dólar projetado na época.
 *
 * Gating: getScope(searchParams); se !scope.isAdmin → 403.
 *
 * Resposta (sempre 200, exceto 401/403): {
 *   grao, horizonte, anos, fontesOk, resultado, calibracao, geradoEm
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
import { expectativaMensal, type FocusPonto } from '@/lib/quotes/focus-client'
import {
  rodarBacktest,
  calibrarPesos,
  type PontoSerie,
} from '@/lib/backtest/engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Cache curto: o backtest é caro (grid search) e os dados mudam no máximo 1x/dia.
export const revalidate = 0

const GRAOS_VALIDOS: Grao[] = ['soja', 'milho']

/** Parse seguro de inteiro com clamp em [min,max] e fallback. */
function intClamp(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = raw === null ? NaN : Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

/** Converte 'MM/AAAA' (mesReferencia do Focus) em chave numérica ano*12+mes-1. */
function chaveRef(mesReferencia: string): number | null {
  const m = /^(\d{2})\/(\d{4})$/.exec(mesReferencia)
  if (!m) return null
  const mes = Number(m[1])
  const ano = Number(m[2])
  if (mes < 1 || mes > 12) return null
  return ano * 12 + (mes - 1)
}

/** Converte 'AAAA-MM-DD' (dataColeta do Focus) em {ano, mes}. */
function parseColeta(dataColeta: string): { ano: number; mes: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataColeta)
  if (!m) return null
  const ano = Number(m[1])
  const mes = Number(m[2])
  if (mes < 1 || mes > 12) return null
  return { ano, mes }
}

/**
 * Reconstrói o "dólar projetado conhecido em cada mês" a partir das coletas
 * históricas do Focus (indicador 'Câmbio'). FUNÇÃO PURA.
 *
 * Para cada mês de COLETA M, escolhe a projeção da menor DataReferencia
 * estritamente futura em relação a M (a projeção de "próximo mês" que o mercado
 * tinha em mãos naquele momento). Mantém a coleta mais recente de cada mês.
 * Resultado: PontoMensal[] (ano/mes da COLETA, valor = mediana projetada).
 */
export function focusProjecaoPorMes(pontos: FocusPonto[]): PontoMensal[] {
  // Agrupa por mês de coleta; dentro do mês, mantém a coleta mais recente
  // (maior dataColeta) e, dela, a menor referência futura.
  type Acc = { coleta: string; chaveColeta: number; melhorRef: number; valor: number }
  const porMes = new Map<number, Acc>()

  for (const p of pontos) {
    if (!Number.isFinite(p.mediana) || p.mediana <= 0) continue
    const col = parseColeta(p.dataColeta)
    const ref = chaveRef(p.mesReferencia)
    if (!col || ref === null) continue
    const chaveColetaMes = col.ano * 12 + (col.mes - 1)
    // só projeções FUTURAS em relação ao mês da coleta.
    if (ref <= chaveColetaMes) continue

    const atual = porMes.get(chaveColetaMes)
    if (!atual) {
      porMes.set(chaveColetaMes, {
        coleta: p.dataColeta,
        chaveColeta: chaveColetaMes,
        melhorRef: ref,
        valor: p.mediana,
      })
      continue
    }
    // coleta mais recente vence; empate → menor referência futura.
    if (p.dataColeta > atual.coleta) {
      atual.coleta = p.dataColeta
      atual.melhorRef = ref
      atual.valor = p.mediana
    } else if (p.dataColeta === atual.coleta && ref < atual.melhorRef) {
      atual.melhorRef = ref
      atual.valor = p.mediana
    }
  }

  return [...porMes.values()]
    .map((a) => ({
      ano: Math.floor(a.chaveColeta / 12),
      mes: (a.chaveColeta % 12) + 1,
      valor: a.valor,
    }))
    .sort((x, y) => x.ano - y.ano || x.mes - y.mes)
}

/** `Promise.allSettled` → valor cumprido ou fallback (best-effort). */
function ok<T>(r: PromiseSettledResult<T>, fallback: T): T {
  return r.status === 'fulfilled' ? r.value : fallback
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // ── Gating SUPERADMIN ─────────────────────────────────────────────────────
  const scope = await getScope(searchParams)
  if (!scope) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!scope.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // ── Parâmetros ────────────────────────────────────────────────────────────
  const graoParam = (searchParams.get('grao') || 'soja').toLowerCase()
  const grao: Grao = GRAOS_VALIDOS.includes(graoParam as Grao)
    ? (graoParam as Grao)
    : 'soja'
  const horizonte = intClamp(searchParams.get('horizonte'), 2, 1, 6)
  // Default usa o máximo histórico (~25 anos desde 2000); configurável até 30.
  const anos = intClamp(searchParams.get('anos'), 25, 1, 30)

  const geradoEm = new Date().toISOString()
  const anoInicial = new Date().getFullYear() - anos

  try {
    // ── Busca paralela best-effort ──────────────────────────────────────────
    const [rPreco, rCbot, rCambio, rFocus] = await Promise.allSettled([
      precoFisicoBR(grao),
      cbotMensal(grao),
      cambioMensal(anoInicial),
      expectativaMensal('Câmbio', 2000),
    ])

    const precos = ok(rPreco, [] as PontoMensal[])
    const cbot = ok(rCbot, [] as PontoMensal[])
    const cambio = ok(rCambio, [] as PontoMensal[])
    const focusPontos = ok(rFocus, [] as FocusPonto[])
    const dolarProj = focusProjecaoPorMes(focusPontos)

    const fontesOk = {
      precoFisico: precos.length > 0,
      cbot: cbot.length > 0,
      cambio: cambio.length > 0,
      dolarProjetado: dolarProj.length > 0,
    }

    // Série gabarito é OBRIGATÓRIA — sem ela não há backtest possível.
    if (precos.length === 0) {
      return NextResponse.json(
        { erro: 'sem_serie_preco', grao, horizonte, anos, fontesOk, geradoEm },
        { status: 200 },
      )
    }

    // Recorta o gabarito para a janela de N anos (asc por ano/mes).
    const precosJanela = precos.filter((p) => p.ano >= anoInicial)
    const baseGabarito = precosJanela.length > 0 ? precosJanela : precos

    // ── Alinha por mês: ordem das séries = [preço, cbot, câmbio, dólarProj] ──
    const linhas = alinharPorMes(baseGabarito, cbot, cambio, dolarProj)

    // Constrói a série do motor: SÓ meses com preço físico (gabarito) válido.
    const serie: PontoSerie[] = []
    for (const l of linhas) {
      const precoFisico = l.valores[0]
      if (precoFisico === null || !Number.isFinite(precoFisico)) continue
      const cbotV = l.valores[1]
      const cambioV = l.valores[2]
      const dolarV = l.valores[3]
      const mes = `${l.ano}-${String(l.mes).padStart(2, '0')}`
      serie.push({
        mes,
        precoFisico,
        // CBOT/câmbio ausentes → 0 (o motor trata variações nulas como neutras).
        cbot: cbotV !== null && Number.isFinite(cbotV) ? cbotV : 0,
        cambio: cambioV !== null && Number.isFinite(cambioV) ? cambioV : 0,
        dolarProj:
          dolarV !== null && Number.isFinite(dolarV) ? dolarV : undefined,
      })
    }

    if (serie.length <= horizonte) {
      return NextResponse.json(
        {
          erro: 'serie_insuficiente',
          grao,
          horizonte,
          anos,
          fontesOk,
          pontos: serie.length,
          geradoEm,
        },
        { status: 200 },
      )
    }

    // ── Backtest + calibração ────────────────────────────────────────────────
    const resultado = rodarBacktest(serie, { horizonteMeses: horizonte })
    resultado.grao = grao
    const calibracao = calibrarPesos(serie, [1, 2, 3])

    return NextResponse.json(
      {
        grao,
        horizonte,
        anos,
        fontesOk,
        pontos: serie.length,
        resultado,
        calibracao,
        geradoEm,
      },
      { status: 200 },
    )
  } catch (e: any) {
    // Nunca derruba o endpoint: devolve 200 com o erro registrado.
    console.warn('[admin/backtest] falhou:', e?.message || e)
    return NextResponse.json(
      {
        erro: 'falha_inesperada',
        detalhe: String(e?.message || e),
        grao,
        horizonte,
        anos,
        geradoEm,
      },
      { status: 200 },
    )
  }
}
