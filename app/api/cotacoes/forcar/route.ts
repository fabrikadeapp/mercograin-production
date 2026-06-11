/**
 * POST /api/cotacoes/forcar
 *
 * Atualização FORÇADA das cotações: o usuário pede explicitamente para buscar
 * dados frescos das fontes externas (câmbio, CBOT, grãos), driblando o cache.
 *
 * Disciplina de orçamento (rate-budget):
 *  - Operação normal opera a 80% do teto (podeConsultar → ok:false ao atingir).
 *  - "Forçar" concede uma folga: mesmo com 80% atingido (ok:false por 'budget'),
 *    ainda consultamos — DESDE QUE não tenhamos passado de 95% do teto ABSOLUTO
 *    da API. Essa reserva de segurança (entre 80% e 95%) evita estourar o limite
 *    real das fontes gratuitas mesmo sob abuso do botão "atualizar agora".
 *  - Acima de 95% do teto absoluto: bloqueio de verdade — serve cache/último e
 *    marca motivo:'budget' (não estoura a API).
 *
 * Nunca lança: o try/catch externo sempre devolve 200 com o que foi possível
 * obter, junto do status de orçamento atual.
 */
import { NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import {
  podeConsultar,
  registrarConsulta,
  statusBudget,
  BUDGETS,
} from '@/lib/quotes/rate-budget'
import { fetchCbotQuotes } from '@/lib/quotes/cbot'
import { getExchangeRate, getGrainPrices } from '@/lib/investing-client'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/** Reserva de segurança ao forçar: teto absoluto que NUNCA pode ser ultrapassado. */
const PCT_RESERVA = 0.95

/**
 * Decide se podemos consultar a fonte sob modo "forçado".
 *
 * Retorna:
 *  - permitido: true  → pode bater na API (registrarConsulta deve ser chamado)
 *  - permitido: false → bloqueado de verdade (passou de 95% absoluto)
 *  - motivo: 'budget' quando o teto normal (80%) já estava atingido mas a folga
 *            de forçar liberou a consulta; 'reserva' quando bloqueou a 95%.
 *
 * Best-effort: em qualquer dúvida/erro libera (degradação graciosa coerente com
 * o restante do rate-budget).
 */
async function avaliarFonteForcada(
  fonte: string,
): Promise<{ permitido: boolean; motivo?: 'budget' | 'reserva' }> {
  try {
    const normal = await podeConsultar(fonte)
    if (normal.ok) {
      // Dentro do teto normal de 80% — consulta livre.
      return { permitido: true }
    }

    // Atingiu o teto normal (80%). Verifica a reserva absoluta (95%) antes de
    // liberar a consulta forçada — assim a folga vive entre 80% e 95%.
    const status = await statusBudget()
    const st = status[fonte]
    const cfg = BUDGETS[fonte]

    // Sem config/status conhecidos: não há teto absoluto rastreável → libera.
    if (!st || !cfg) {
      return { permitido: true, motivo: 'budget' }
    }

    const tetoAbsDia = Math.floor(cfg.perDay * PCT_RESERVA)
    const tetoAbsMin = Math.floor(cfg.perMin * PCT_RESERVA)

    const estourouReserva = st.usadoDia >= tetoAbsDia || st.usadoMin >= tetoAbsMin
    if (estourouReserva) {
      // Bloqueio real: não consulta, serve cache/último.
      return { permitido: false, motivo: 'reserva' }
    }

    // Entre 80% e 95%: forçar liberou a consulta.
    return { permitido: true, motivo: 'budget' }
  } catch (err) {
    console.warn('[cotacoes/forcar] avaliarFonteForcada falhou, liberando:', err)
    return { permitido: true }
  }
}

export async function POST(req: Request) {
  const atualizadoEm = new Date().toISOString()
  const fontesUsadas: string[] = []
  // Marca quais fontes foram puladas por orçamento (servindo cache/último).
  const motivos: Record<string, string> = {}

  // Resultados (null quando não foi possível obter / pulado por budget).
  let cambio: number | null = null
  const cbot: { soja: number | null; milho: number | null; trigo: number | null } = {
    soja: null,
    milho: null,
    trigo: null,
  }

  try {
    const { searchParams } = new URL(req.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // ── Câmbio (AwesomeAPI via getExchangeRate) ──────────────────────────────
    const decisaoCambio = await avaliarFonteForcada('awesomeapi')
    if (decisaoCambio.permitido) {
      cambio = await getExchangeRate()
      await registrarConsulta('awesomeapi')
      fontesUsadas.push('awesomeapi')
      if (decisaoCambio.motivo === 'budget') motivos['awesomeapi'] = 'budget'
    } else {
      motivos['awesomeapi'] = 'budget'
    }

    // ── CBOT (Yahoo via fetchCbotQuotes) ─────────────────────────────────────
    const decisaoCbot = await avaliarFonteForcada('yahoo')
    if (decisaoCbot.permitido) {
      const q = await fetchCbotQuotes()
      cbot.soja = q.soja
      cbot.milho = q.milho
      cbot.trigo = q.trigo
      await registrarConsulta('yahoo')
      fontesUsadas.push('yahoo')
      if (decisaoCbot.motivo === 'budget') motivos['yahoo'] = 'budget'
    } else {
      motivos['yahoo'] = 'budget'
    }

    // ── Grãos (getGrainPrices). Internamente usa awesomeapi (câmbio) + fontes
    //    de grãos; contabilizamos sob 'awesomeapi' por ser a fonte externa do
    //    câmbio embutido. Só consultamos se a reserva permitir. ──────────────
    const decisaoGraos = await avaliarFonteForcada('awesomeapi')
    if (decisaoGraos.permitido) {
      const graos = await getGrainPrices()
      // Câmbio dos grãos serve de fallback caso a chamada direta tenha falhado.
      if (cambio === null && graos.taxaCambio !== null) cambio = graos.taxaCambio
      // CBOT não é sobrescrito por grãos (fontes distintas); grãos completam só câmbio.
      await registrarConsulta('awesomeapi')
      if (!fontesUsadas.includes('awesomeapi')) fontesUsadas.push('awesomeapi')
    } else if (!('awesomeapi' in motivos)) {
      motivos['awesomeapi'] = 'budget'
    }

    const budget = await statusBudget()
    const forcadoComSucesso = fontesUsadas.length > 0

    return NextResponse.json({
      atualizadoEm,
      cambio,
      cbot,
      fontesUsadas,
      motivos,
      budget,
      forcadoComSucesso,
    })
  } catch (err: any) {
    console.error('[cotacoes/forcar] erro:', err?.message || err)
    // Sempre 200 com o que foi possível obter.
    let budget: Awaited<ReturnType<typeof statusBudget>> = {}
    try {
      budget = await statusBudget()
    } catch {
      budget = {}
    }
    return NextResponse.json({
      atualizadoEm,
      cambio,
      cbot,
      fontesUsadas,
      motivos,
      budget,
      forcadoComSucesso: false,
      erro: err?.message || 'falha ao forçar atualização',
    })
  }
}
