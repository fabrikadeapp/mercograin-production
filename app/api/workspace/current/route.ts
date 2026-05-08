import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireScope } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const scope = await requireScope()
    const ws = await db.workspace.findUnique({
      where: { id: scope.workspaceId },
      include: {
        empresa: true,
        subscription: true,
        _count: { select: { members: { where: { status: 'active' } } } },
      },
    })
    if (!ws) {
      return NextResponse.json({ error: 'workspace_not_found' }, { status: 404 })
    }
    return NextResponse.json({
      workspace: {
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        ownerId: ws.ownerId,
        empresa: ws.empresa,
        subscription: ws.subscription,
        memberCount: ws._count.members,
        role: scope.workspaceRole,
        isOwner: scope.isWorkspaceOwner,
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'unauthorized' },
      { status: 401 }
    )
  }
}
