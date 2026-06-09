/**
 * GET /api/match/sugerir — sugere matches oferta(venda) × demanda(compra).
 * Feature-gated por 'match'. Carrega ofertas abertas do workspace e ranqueia.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { isFeatureEnabled } from '@/lib/features'
import { sugerirMatches, type OfertaLike } from '@/lib/match'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await isFeatureEnabled(scope.workspaceId, 'match'))) {
    return NextResponse.json({ error: 'feature_disabled' }, { status: 403 })
  }

  const ofertas = await db.oferta.findMany({
    where: scope.whereOwn({ status: 'aberta', validaAte: { gt: new Date() } }),
    take: 500,
    select: {
      id: true, numero: true, tipo: true, cultura: true, qtdSc: true, precoSc: true,
      precoMoeda: true, origem: true, destino: true, janelaEntrega: true, qualidadeSpec: true,
    },
  })

  const byId = new Map(ofertas.map((o) => [o.id, o]))
  const input: OfertaLike[] = ofertas.map((o) => ({
    id: o.id, tipo: o.tipo, cultura: o.cultura,
    qtdSc: Number(o.qtdSc), precoSc: Number(o.precoSc), precoMoeda: o.precoMoeda,
    origem: o.origem, destino: o.destino, janelaEntrega: o.janelaEntrega,
    qualidadeSpec: (o.qualidadeSpec as Record<string, number> | null) ?? null,
  }))

  const matches = sugerirMatches(input, 40).slice(0, 100).map((m) => {
    const venda = byId.get(m.ofertaId)
    const compra = byId.get(m.demandaId)
    return {
      ...m,
      venda: venda && { numero: venda.numero, cultura: venda.cultura, qtdSc: Number(venda.qtdSc), precoSc: Number(venda.precoSc) },
      compra: compra && { numero: compra.numero, cultura: compra.cultura, qtdSc: Number(compra.qtdSc), precoSc: Number(compra.precoSc) },
    }
  })

  return NextResponse.json({ ok: true, matches, totalOfertas: ofertas.length })
}
