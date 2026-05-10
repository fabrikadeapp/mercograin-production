/**
 * S10 M2 — Marketplace público (cross-tenant READ-ONLY).
 *
 * GET /api/ofertas/marketplace?cultura=&tipo=&precoMin=&precoMax=
 *
 * Retorna ofertas com `publica=true` e `status='aberta'` de TODOS workspaces.
 * Inclui campos do workspace originador apenas como label público (name) —
 * NÃO devolve relações sensíveis (clientes, contratos, etc).
 *
 * Auth: precisa de sessão (anônimos não veem marketplace). Mas a visão é
 * agregada e read-only — nenhuma escrita cruza workspaces.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { buildWhere, expirarVencidas } from '@/lib/ofertas/service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Limpa vencidas globalmente (best-effort). Mantém marketplace honesto.
  await expirarVencidas().catch(() => {})

  const sp = req.nextUrl.searchParams
  // workspaceId=null pra varrer todos; força publica/aberta
  const where = {
    ...buildWhere(null, {
      cultura: sp.get('cultura') || undefined,
      tipo: (sp.get('tipo') as any) || undefined,
      precoMin: sp.get('precoMin') ? Number(sp.get('precoMin')) : undefined,
      precoMax: sp.get('precoMax') ? Number(sp.get('precoMax')) : undefined,
    }),
    publica: true,
    status: 'aberta',
  }

  const ofertas = await db.oferta.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      workspace: { select: { name: true, slug: true } },
    },
  })

  // Filtra campos públicos — não devolve observacao privada se workspace diferente
  const out = ofertas.map((o) => ({
    id: o.id,
    numero: o.numero,
    tipo: o.tipo,
    cultura: o.cultura,
    qtdSc: o.qtdSc,
    precoSc: o.precoSc,
    precoMoeda: o.precoMoeda,
    origem: o.origem,
    destino: o.destino,
    validaAte: o.validaAte,
    createdAt: o.createdAt,
    // Workspace originador como label público
    originador: {
      name: o.workspace.name,
      slug: o.workspace.slug,
    },
    // own=true ajuda UI a desabilitar botão "aceitar" pro próprio workspace
    own: o.workspaceId === scope.workspaceId,
  }))

  return NextResponse.json({ ofertas: out, total: out.length })
}
