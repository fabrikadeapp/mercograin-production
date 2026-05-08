import { db } from '@/lib/db'

/**
 * Retorna a Subscription ativa do workspace que o user é owner (primeiro owned).
 * Mantém a assinatura legada `getUserSubscription(userId)` para callers existentes.
 */
export async function getUserSubscription(userId: string) {
  const ws = await db.workspace.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: 'asc' },
    include: { subscription: true },
  })
  return ws?.subscription ?? null
}

export async function getWorkspaceSubscription(workspaceId: string) {
  return db.subscription.findUnique({ where: { workspaceId } })
}

export function isAccessAllowed(sub: { status: string } | null | undefined): boolean {
  if (!sub) return false
  return ['trialing', 'active'].includes(sub.status)
}
