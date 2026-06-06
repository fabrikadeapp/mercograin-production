/**
 * GET /api/me/nav-context
 * Retorna o contexto de navegação para o AppShell:
 * - features habilitadas no workspace ativo
 * - áreas permitidas para o membro
 * - nome de exibição
 * - nome do workspace
 */
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { loadFeaturesFor } from '@/lib/features'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = session?.user as any
  if (!u?.id) {
    return NextResponse.json({ ok: false, features: {} }, { status: 401 })
  }

  const membership = await db.workspaceMember
    .findFirst({
      where: { userId: u.id, status: 'active' },
      include: { workspace: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    .catch(() => null)

  const workspaceId = membership?.workspaceId
  const features = workspaceId
    ? await loadFeaturesFor(workspaceId).catch(() => ({}))
    : {}
  return NextResponse.json({
    ok: true,
    features,
    permittedAreas: membership?.areasPermitidas ?? [],
    userName: u.nome ?? u.email ?? null,
    workspaceName: membership?.workspace?.name ?? null,
  })
}
