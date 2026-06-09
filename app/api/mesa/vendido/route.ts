/**
 * GET /api/mesa/vendido
 *
 * Volume e valor vendido por janela temporal (hoje, semana, quinzena, 30 dias).
 * "Vendido" = contratos assinados (statusAssinatura='assinado'), com valor via
 * proposta.valorTotal e tonelagem via proposta.graos[].quantidade.
 * A janela usa `assinadoEm` (fallback `criadoEm`).
 *
 * Retorno: { ok, periodos: [{ key, label, valor, toneladas }] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function toneladasDeGraos(graos: unknown): number {
  if (!Array.isArray(graos)) return 0
  return graos.reduce((sum, g) => {
    if (g && typeof g === 'object') {
      const q = Number((g as Record<string, unknown>).quantidade ?? 0)
      return sum + (Number.isFinite(q) ? q : 0)
    }
    return sum
  }, 0)
}

const PERIODOS = [
  { key: 'hoje', label: 'Hoje', dias: 1 },
  { key: 'semana', label: 'Semana', dias: 7 },
  { key: 'quinzena', label: 'Quinzena', dias: 15 },
  { key: 'mes', label: '30 dias', dias: 30 },
] as const

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Carrega os contratos assinados dos últimos 30 dias uma única vez e
  // agrega em memória por janela (mais barato que 4 queries).
  const desde = new Date(Date.now() - 30 * 86_400_000)
  const contratos = await db.contrato.findMany({
    where: scope.whereOwn({
      statusAssinatura: 'assinado',
      OR: [{ assinadoEm: { gte: desde } }, { assinadoEm: null, criadoEm: { gte: desde } }],
    }),
    select: {
      assinadoEm: true,
      criadoEm: true,
      proposta: { select: { valorTotal: true, graos: true } },
    },
  })

  const now = Date.now()
  const periodos = PERIODOS.map((p) => {
    const limite = now - p.dias * 86_400_000
    let valor = 0
    let toneladas = 0
    for (const c of contratos) {
      const ref = (c.assinadoEm ?? c.criadoEm).getTime()
      if (ref >= limite) {
        valor += Number(c.proposta?.valorTotal ?? 0)
        toneladas += toneladasDeGraos(c.proposta?.graos)
      }
    }
    return { key: p.key, label: p.label, valor, toneladas }
  })

  return NextResponse.json({ ok: true, periodos })
}
