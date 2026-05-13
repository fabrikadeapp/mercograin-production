/**
 * BH Grain — Feature flag global única (Lote 5).
 *
 * Convenção (decidida no Lote 0): SystemConfig.key = 'bhgrain.v1'
 * value: { enabled: boolean }
 *
 * Não é por workspace nesta fase. Liga/desliga o conjunto inteiro de cards
 * novos. Quando estiver estável, esta flag deve cair (limpeza no L10).
 */

import { db } from '@/lib/db'

const KEY = 'bhgrain.v1'

let cache: { value: boolean; expiresAt: number } | null = null
const TTL_MS = 30_000

export async function isBhGrainV1Enabled(): Promise<boolean> {
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

export function invalidateBhGrainFlag(): void {
  cache = null
}
