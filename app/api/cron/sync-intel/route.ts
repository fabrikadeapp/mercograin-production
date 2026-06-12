/**
 * Cron LENTAS — refresca o cache das fontes de inteligência (de hora em hora).
 *
 * Fontes: CEPEA, Focus, CONAB, USDA-PSD, USDA-ESR, COT.
 *
 * Diferente do `sync-cotacoes` (preço ao vivo + persistência), este cron NÃO
 * cria/persiste tabelas novas: as libs de cada fonte já mantêm cache in-memory
 * (TTL 6h–12h). Chamar a função já dispara o revalidate do cache — então o
 * objetivo aqui é apenas "aquecer" esses caches para que quem acessar as
 * páginas de intel encontre dados frescos sem esperar o fetch externo.
 *
 * Disciplina de orçamento (rate-budget, teto 80%):
 *  - Antes de cada fonte, `podeConsultar(fonte)`. Se ok=false (perto do teto
 *    de 80% — protege especialmente a chave USDA), PULA e marca {fonte:'budget'}.
 *  - Se ok=true, busca e `registrarConsulta(fonte)`.
 *
 * Auth: header `Authorization: Bearer ${CRON_SECRET}` (GitHub Actions OU cron
 * externo). Sem secret → 500; secret errado → 401.
 *
 * Robustez: Promise.allSettled — uma fonte falhar não derruba as outras. O
 * try/catch externo sempre devolve 200 com o que foi possível fazer.
 *
 * Schedule sugerido: de hora em hora (janela ampla diurna). Ver
 * `.github/workflows/cron-sync-intel.yml`.
 */
import { NextResponse } from 'next/server'
import { podeConsultar, registrarConsulta, statusBudget } from '@/lib/quotes/rate-budget'
import { fetchCepeaQuotes } from '@/lib/quotes/cepea'
import { expectativaMensal, curvaDolarFuturo } from '@/lib/quotes/focus-client'
import { safraBrasil } from '@/lib/quotes/conab-client'
import { buscarMundo, USDA_CODES } from '@/lib/usda/psd-client'
import { resumoExportacao } from '@/lib/usda/esr-client'
import { cotHistorico } from '@/lib/historico/cot-client'
import { captureMessage } from '@/lib/observability/capture'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Descritor de fonte: a `fonte` é a chave do rate-budget e o `refrescar` é a
 * ação que dispara o revalidate do cache da lib. Nenhuma ação persiste tabelas
 * novas — apenas aquece os caches existentes.
 */
interface FonteIntel {
  /** Chave no rate-budget (BUDGETS). */
  fonte: string
  /** Dispara o refresh do cache da lib correspondente. Pode lançar. */
  refrescar: () => Promise<unknown>
}

/** Ano-safra corrente — base para as consultas USDA. */
function anoCorrente(): number {
  return new Date().getUTCFullYear()
}

const FONTES: FonteIntel[] = [
  // CEPEA — preço indicador dos 3 grãos (agrega numa chamada).
  { fonte: 'cepea', refrescar: () => fetchCepeaQuotes(['soja', 'milho', 'trigo']) },
  // Focus — expectativa mensal de câmbio + curva de dólar futuro.
  {
    fonte: 'focus',
    refrescar: async () => {
      await expectativaMensal('Câmbio')
      await curvaDolarFuturo()
    },
  },
  // CONAB — safra Brasil (soja + milho).
  {
    fonte: 'conab',
    refrescar: async () => {
      await safraBrasil('SOJA')
      await safraBrasil('MILHO')
    },
  },
  // USDA PSD — balanço mundial (soja + milho). Compartilha a chave USDA.
  {
    fonte: 'usda-psd',
    refrescar: async () => {
      const ano = anoCorrente()
      await buscarMundo(USDA_CODES.soja, ano)
      await buscarMundo(USDA_CODES.milho, ano)
    },
  },
  // USDA ESR — exportações semanais (soja + milho). Compartilha a chave USDA.
  {
    fonte: 'usda-esr',
    refrescar: async () => {
      const ano = anoCorrente()
      await resumoExportacao('soja', ano)
      await resumoExportacao('milho', ano)
    },
  },
  // COT — posicionamento histórico (soja + milho).
  {
    fonte: 'cot',
    refrescar: async () => {
      await cotHistorico('soja')
      await cotHistorico('milho')
    },
  },
]

/**
 * Mapeia a chave de fonte do cron para a chave do rate-budget. As duas fontes
 * USDA (psd/esr) consomem a MESMA chave de API → contabilizam sob 'usda'.
 */
function chaveBudget(fonte: string): string {
  if (fonte === 'usda-psd' || fonte === 'usda-esr') return 'usda'
  return fonte
}

async function handle(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    captureMessage('cron sync-intel: CRON_SECRET ausente', 'error')
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const atualizadoEm = new Date().toISOString()
  const fontesOk: string[] = []
  const fontesPuladas: string[] = []
  const erros: string[] = []

  try {
    // Avalia o orçamento de cada fonte ANTES de buscar (em paralelo).
    const decisoes = await Promise.allSettled(
      FONTES.map((f) => podeConsultar(chaveBudget(f.fonte))),
    )

    // Dispara o refresh apenas das fontes liberadas — allSettled isola falhas.
    const acoes = await Promise.allSettled(
      FONTES.map(async (f, i) => {
        const decisao = decisoes[i]
        const liberada = decisao.status === 'fulfilled' ? decisao.value.ok : true
        if (!liberada) {
          return { fonte: f.fonte, status: 'budget' as const }
        }
        await f.refrescar()
        await registrarConsulta(chaveBudget(f.fonte))
        return { fonte: f.fonte, status: 'ok' as const }
      }),
    )

    for (let i = 0; i < acoes.length; i++) {
      const r = acoes[i]
      const nome = FONTES[i].fonte
      if (r.status === 'fulfilled') {
        if (r.value.status === 'budget') fontesPuladas.push(nome)
        else fontesOk.push(nome)
      } else {
        const reason = r.reason as { message?: string } | string | undefined
        const msg = typeof reason === 'string' ? reason : reason?.message || String(reason)
        erros.push(`${nome}: ${msg}`)
      }
    }

    const budget = await statusBudget()
    const ok = erros.length === 0

    captureMessage(
      `cron sync-intel ${ok ? 'OK' : 'PARCIAL'} ok=${fontesOk.length} puladas=${fontesPuladas.length} erros=${erros.length}`,
      ok ? 'info' : 'warning',
      { fontesOk, fontesPuladas, erros },
    )

    return NextResponse.json(
      { ok, atualizadoEm, fontesOk, fontesPuladas, erros, budget },
      { status: 200 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    captureMessage(`cron sync-intel: erro inesperado — ${msg}`, 'error')
    let budget: Awaited<ReturnType<typeof statusBudget>> = {}
    try {
      budget = await statusBudget()
    } catch {
      budget = {}
    }
    // Sempre 200 com o que foi possível fazer.
    return NextResponse.json(
      { ok: false, atualizadoEm, fontesOk, fontesPuladas, erros: [...erros, msg], budget },
      { status: 200 },
    )
  }
}

export const GET = handle
export const POST = handle
