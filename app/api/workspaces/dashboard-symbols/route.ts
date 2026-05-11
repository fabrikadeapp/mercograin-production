/**
 * GET / PATCH / DELETE /api/workspaces/dashboard-symbols
 *
 * Gerencia Workspace.dashboardSymbols — lista de IDs de commodities visíveis
 * no widget do dashboard. owner/admin podem alterar.
 *
 * DELETE volta para o default (campo nulo = usa DEFAULT_DASHBOARD_IDS).
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { COMMODITIES_BY_ID, DEFAULT_DASHBOARD_IDS } from '@/lib/commodities/catalog'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function canManage(role: string | undefined, isAdmin: boolean) {
  if (isAdmin) return true
  return role === 'owner' || role === 'admin'
}

export async function GET() {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const ws = await db.workspace.findUnique({
      where: { id: scope.workspaceId },
      select: { dashboardSymbols: true },
    })
    const ids = Array.isArray(ws?.dashboardSymbols)
      ? (ws.dashboardSymbols as unknown as string[])
      : null
    return NextResponse.json({
      selectedIds: ids ?? DEFAULT_DASHBOARD_IDS,
      isCustom: ids !== null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    if (!canManage(scope.workspaceRole, scope.isAdmin)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = (await req.json().catch(() => null)) as { ids?: string[] } | null
    if (!body || !Array.isArray(body.ids)) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
    }

    // Filtra apenas IDs válidos para não permitir injeção de strings arbitrárias
    const filtered = body.ids.filter((id) => COMMODITIES_BY_ID.has(id))

    await db.workspace.update({
      where: { id: scope.workspaceId },
      data: { dashboardSymbols: filtered as unknown as object },
    })
    return NextResponse.json({ ok: true, selectedIds: filtered })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    if (!canManage(scope.workspaceRole, scope.isAdmin)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    await db.workspace.update({
      where: { id: scope.workspaceId },
      data: { dashboardSymbols: null as any },
    })
    return NextResponse.json({ ok: true, selectedIds: DEFAULT_DASHBOARD_IDS, isCustom: false })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
