import { db } from '@/lib/db'

export async function getUserSubscription(userId: string) {
  return db.subscription.findUnique({ where: { userId } })
}

export function isAccessAllowed(sub: { status: string } | null | undefined): boolean {
  if (!sub) return false
  return ['trialing', 'active'].includes(sub.status)
}
