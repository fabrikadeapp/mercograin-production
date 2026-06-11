/**
 * app/api/relatorios-usda/[id]/share/route.ts
 *
 * POST → gera um link público (HMAC) para o relatório USDA {id} do workspace.
 *        TTL configurável via body { ttlDays } (default 90 dias).
 *        Retorna { url, token, expiraEm } — a página pública lê o token.
 *
 * Gating: feature 'relatorios_usda'. Só gera link para relatório do próprio
 * workspace (multi-tenancy via getScope/whereOwn).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import { db } from '@/lib/db'
import { gerarTokenRelatorio } from '@/lib/usda/share-token'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const FEATURE = 'relatorios_usda' as const

const bodySchema = z
  .object({
    ttlDays: z.number().int().min(1).max(365).optional(),
  })
  .nullable()

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const scope = await getScope()
    if (!scope || !scope.workspaceId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const liberado = await isFeatureEnabled(scope.workspaceId, FEATURE)
    if (!liberado) {
      return NextResponse.json({ error: 'feature_disabled' }, { status: 403 })
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid' }, { status: 400 })
    }
    const ttlDays = parsed.data?.ttlDays ?? 90

    // Garante que o relatório é do workspace antes de gerar o link.
    const relatorio = await db.relatorioUsda.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      select: { id: true },
    })
    if (!relatorio) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    const { token, expiraEm } = gerarTokenRelatorio(relatorio.id, { ttlDays })

    return NextResponse.json({
      url: `/relatorios-usda/publico/${token}`,
      token,
      expiraEm: expiraEm.toISOString(),
    })
  } catch (err) {
    console.error('[relatorios-usda/share] POST erro:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
