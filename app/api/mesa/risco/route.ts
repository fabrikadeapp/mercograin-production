/**
 * GET /api/mesa/risco
 *
 * Alertas de risco & limites da Mesa. Combina LimiteRisco ativos com seus
 * LimiteBreach não resolvidos (exposição atual vs teto). Ordena por severidade
 * e % de utilização.
 *
 * Retorno: { ok, alertas: number, items: [{ id, escopo, tipo, label,
 *            valorMaximo, valorAtual, percentUso, severidade, href }] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TIPO_LABEL: Record<string, string> = {
  exposicao_usd: 'Exposição USD',
  exposicao_brl: 'Exposição BRL',
  qtd_sc: 'Quantidade (sc)',
  var_usd: 'VaR da carteira',
  pnl_neg_usd: 'P&L negativo',
}

const ESCOPO_LABEL: Record<string, string> = {
  total: 'Carteira total',
  cultura: 'Cultura',
  corretor: 'Corretor',
  mesa: 'Mesa',
  contraparte: 'Contraparte',
  regiao: 'Região',
}

const SEV_ORDER: Record<string, number> = { critico: 3, breach: 2, aviso: 1 }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const limites = await db.limiteRisco.findMany({
    where: scope.whereOwn({ ativo: true }),
    take: 50,
    include: {
      breaches: {
        where: { resolvidoEm: null },
        orderBy: { detectadoEm: 'desc' },
        take: 1,
      },
    },
  })

  const items = limites.map((l) => {
    const breach = l.breaches[0]
    const valorMaximo = Number(l.valorMaximo)
    const valorAtual = breach ? Number(breach.valorAtual) : 0
    const percentUso = valorMaximo > 0 ? Math.round((valorAtual / valorMaximo) * 100) : 0
    const severidade = breach?.severidade ?? (percentUso >= 100 ? 'breach' : percentUso >= 80 ? 'aviso' : 'ok')
    const escFiltro =
      l.escopoFiltro && typeof l.escopoFiltro === 'object'
        ? Object.values(l.escopoFiltro as Record<string, unknown>).filter(Boolean).join(' · ')
        : ''
    return {
      id: l.id,
      escopo: l.escopo,
      tipo: l.tipo,
      label: `${TIPO_LABEL[l.tipo] ?? l.tipo} · ${ESCOPO_LABEL[l.escopo] ?? l.escopo}${escFiltro ? ` (${escFiltro})` : ''}`,
      valorMaximo,
      valorAtual,
      percentUso,
      severidade,
      href: '/risco',
    }
  })

  // Mostra primeiro os com breach/maior uso. Itens "ok" ficam ao fim.
  items.sort(
    (a, b) =>
      (SEV_ORDER[b.severidade] ?? 0) - (SEV_ORDER[a.severidade] ?? 0) ||
      b.percentUso - a.percentUso,
  )

  const alertas = items.filter((i) => i.severidade !== 'ok').length

  return NextResponse.json({ ok: true, alertas, items })
}
