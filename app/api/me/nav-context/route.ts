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
import { listAccessibleAreas } from '@/lib/areas'

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
      include: { workspace: { select: { id: true, name: true, ownerId: true } } },
      orderBy: { createdAt: 'desc' },
    })
    .catch(() => null)

  const workspaceId = membership?.workspaceId
  const features = workspaceId
    ? await loadFeaturesFor(workspaceId).catch(() => ({}))
    : {}
  const subscription = workspaceId
    ? await db.subscription
        .findUnique({
          where: { workspaceId },
          select: { status: true },
        })
        .catch(() => null)
    : null

  // Resolve as áreas com o bypass de admin global / owner do workspace.
  // Antes retornávamos `areasPermitidas` cru — o que escondia áreas novas
  // (ex.: BH Intelligence) mesmo para owner/admin, pois o array salvo no
  // membership não as listava. listAccessibleAreas aplica as regras corretas.
  const isOwner = membership?.workspace?.ownerId === u.id
  const permittedAreas = listAccessibleAreas({
    globalRole: u.role ?? null,
    workspaceRole: isOwner ? 'owner' : (membership?.role ?? null),
    areasPermitidas: membership?.areasPermitidas ?? null,
  })

  return NextResponse.json({
    ok: true,
    features,
    permittedAreas,
    userName: u.nome ?? u.email ?? null,
    workspaceName: membership?.workspace?.name ?? null,
    subscriptionStatus: subscription?.status ?? null,
  })
}
