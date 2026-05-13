/**
 * BH Grain — Modo demonstração.
 *
 * Lê SystemConfig.key='bhgrain.demo' = { enabled: boolean }.
 * Cache em memória 30s para evitar hit por request.
 */

import { db } from '@/lib/db'

const KEY = 'bhgrain.demo'
let cache: { value: boolean; expiresAt: number } | null = null
const TTL_MS = 30_000

export async function isDemoModeEnabled(): Promise<boolean> {
  const now = Date.now()
  if (cache && cache.expiresAt > now) return cache.value
  try {
    const row = await db.systemConfig.findUnique({ where: { key: KEY } })
    const v = row?.value as { enabled?: boolean } | null
    const enabled = !!v?.enabled
    cache = { value: enabled, expiresAt: now + TTL_MS }
    return enabled
  } catch {
    return false
  }
}

export async function setDemoMode(enabled: boolean, updatedBy?: string): Promise<void> {
  await db.systemConfig.upsert({
    where: { key: KEY },
    create: { key: KEY, value: { enabled }, updatedBy: updatedBy ?? null },
    update: { value: { enabled }, updatedBy: updatedBy ?? null },
  })
  cache = null
}

export function invalidateDemoCache(): void {
  cache = null
}
