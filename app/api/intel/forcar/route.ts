/**
 * POST /api/intel/forcar
 *
 * Atualização FORÇADA de TODAS as fontes da inteligência (intel): o usuário
 * clica em "Atualizar agora" numa página de intel (panorama, veredito,
 * integrada, relatórios USDA) e este endpoint dispara o refresh de cada fonte
 * lenta — driblando os caches das libs ao chamar diretamente suas funções de
 * fetch (que reaquece o cache in-memory de cada client).
 *
 * Fontes orquestradas (best-effort, isoladas via allSettled):
 *   - USDA PSD   (lib/usda/psd-client → buscarMundo)        → budget 'usda'
 *   - USDA ESR   (lib/usda/esr-client → resumoExportacao)   → budget 'usda'
 *   - BCB Focus  (lib/quotes/focus-client → curvaDolarFuturo) → budget 'focus'
 *   - CONAB      (lib/quotes/conab-client → safraBrasil)     → budget 'conab'
 *   - COT        (lib/historico/cot-client → cotHistorico)   → budget 'cot'
 *   - CBOT       (lib/quotes/cbot → fetchCbotQuotes)         → budget 'yahoo'
 *   - Câmbio BCB (lib/quotes/bcb → fetchBcbDolar)            → budget 'awesomeapi'
 *
 * Disciplina de orçamento (rate-budget), idêntica a /api/cotacoes/forcar:
 *  - Operação normal opera a 80% do teto (podeConsultar → ok:false ao atingir).
 *  - "Forçar" concede folga: mesmo com 80% atingido, ainda consultamos — DESDE
 *    QUE não tenhamos passado de 95% do teto ABSOLUTO da API (reserva mínima).
 *  - Acima de 95%: bloqueio real — serve cache (a fonte vai para
 *    `fontesNoLimite`), protegendo a chave (em especial a chave USDA).
 *
 * Segurança/gating:
 *  - getScope → 401 sem sessão/workspace.
 *  - isFeatureEnabled(ws, 'relatorios_usda') → 403.
 *
 * Nunca lança: o try/catch externo sempre devolve 200 com o que foi possível
 * atualizar + o status de orçamento atual.
 */
import { NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import {
  podeConsultar,
  registrarConsulta,
  statusBudget,
  BUDGETS,
} from '@/lib/quotes/rate-budget'
import { buscarMundo, USDA_CODES } from '@/lib/usda/psd-client'
import { resumoExportacao } from '@/lib/usda/esr-client'
import { curvaDolarFuturo } from '@/lib/quotes/focus-client'
import { safraBrasil } from '@/lib/quotes/conab-client'
import { cotHistorico } from '@/lib/historico/cot-client'
import { fetchCbotQuotes } from '@/lib/quotes/cbot'
import { fetchBcbDolar } from '@/lib/quotes/bcb'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const fetchCache = 'force-no-store'

const FEATURE = 'relatorios_usda' as const

/** Reserva de segurança ao forçar: teto absoluto que NUNCA pode ser ultrapassado. */
const PCT_RESERVA = 0.95

/**
 * Decide se podemos consultar a fonte sob modo "forçado" (até 95% do teto real).
 *  - permitido:true  → pode bater na API (registrarConsulta deve ser chamado).
 *  - permitido:false → bloqueado de verdade (passou de 95% absoluto) → serve cache.
 * Best-effort: em qualquer dúvida/erro libera (degradação graciosa).
 */
async function avaliarFonteForcada(fonte: string): Promise<{ permitido: boolean }> {
  try {
    const normal = await podeConsultar(fonte)
    if (normal.ok) return { permitido: true }

    // Atingiu o teto normal (80%). Verifica a reserva absoluta (95%).
    const status = await statusBudget()
    const st = status[fonte]
    const cfg = BUDGETS[fonte]

    // Sem config/status rastreáveis: não há teto absoluto → libera.
    if (!st || !cfg) return { permitido: true }

    const tetoAbsDia = Math.floor(cfg.perDay * PCT_RESERVA)
    const tetoAbsMin = Math.floor(cfg.perMin * PCT_RESERVA)
    const estourouReserva = st.usadoDia >= tetoAbsDia || st.usadoMin >= tetoAbsMin
    if (estourouReserva) return { permitido: false }

    // Entre 80% e 95%: forçar liberou a consulta.
    return { permitido: true }
  } catch (err) {
    console.warn('[intel/forcar] avaliarFonteForcada falhou, liberando:', err)
    return { permitido: true }
  }
}

/**
 * Executa o refresh de uma fonte respeitando a reserva. Em sucesso, registra a
 * consulta e adiciona à lista de atualizadas; se a reserva bloqueou, adiciona à
 * lista de "no limite" (serviu cache). Nunca lança — qualquer falha do fetch
 * apenas é logada (a fonte simplesmente não entra em `atualizadas`).
 */
async function refrescarFonte(
  rotulo: string,
  fonteBudget: string,
  fetcher: () => Promise<unknown>,
  atualizadas: string[],
  noLimite: string[],
): Promise<void> {
  try {
    const decisao = await avaliarFonteForcada(fonteBudget)
    if (!decisao.permitido) {
      if (!noLimite.includes(rotulo)) noLimite.push(rotulo)
      return
    }
    await fetcher()
    await registrarConsulta(fonteBudget)
    if (!atualizadas.includes(rotulo)) atualizadas.push(rotulo)
  } catch (err) {
    // Fetcher best-effort já deveria engolir erros; aqui é só rede de segurança.
    console.warn(`[intel/forcar] refresh de '${rotulo}' falhou:`, err)
  }
}

export async function POST(req: Request) {
  const atualizadoEm = new Date().toISOString()
  const fontesAtualizadas: string[] = []
  const fontesNoLimite: string[] = []

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

    // 3. Refresh de todas as fontes em paralelo (isoladas, best-effort).
    //    O ano-safra de referência usa a data/hora atual (produção pode).
    const anoSafra = new Date().getUTCFullYear()

    await Promise.allSettled([
      refrescarFonte(
        'usda_psd',
        'usda',
        () => buscarMundo(USDA_CODES.soja, anoSafra),
        fontesAtualizadas,
        fontesNoLimite,
      ),
      refrescarFonte(
        'usda_esr',
        'usda',
        () => resumoExportacao('soja', anoSafra),
        fontesAtualizadas,
        fontesNoLimite,
      ),
      refrescarFonte(
        'focus',
        'focus',
        () => curvaDolarFuturo(),
        fontesAtualizadas,
        fontesNoLimite,
      ),
      refrescarFonte(
        'conab',
        'conab',
        () => safraBrasil('SOJA'),
        fontesAtualizadas,
        fontesNoLimite,
      ),
      refrescarFonte(
        'cot',
        'cot',
        () => cotHistorico('soja'),
        fontesAtualizadas,
        fontesNoLimite,
      ),
      refrescarFonte(
        'cbot',
        'yahoo',
        () => fetchCbotQuotes(),
        fontesAtualizadas,
        fontesNoLimite,
      ),
      refrescarFonte(
        'cambio',
        'awesomeapi',
        () => fetchBcbDolar(),
        fontesAtualizadas,
        fontesNoLimite,
      ),
    ])

    const budget = await statusBudget()

    return NextResponse.json({
      ok: fontesAtualizadas.length > 0,
      atualizadoEm,
      fontesAtualizadas,
      fontesNoLimite,
      budget,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[intel/forcar] erro:', msg)
    // Sempre 200 com o que foi possível atualizar.
    let budget: Awaited<ReturnType<typeof statusBudget>> = {}
    try {
      budget = await statusBudget()
    } catch {
      budget = {}
    }
    return NextResponse.json({
      ok: false,
      atualizadoEm,
      fontesAtualizadas,
      fontesNoLimite,
      budget,
      erro: msg || 'falha ao forçar atualização da intel',
    })
  }
}
