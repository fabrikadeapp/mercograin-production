/**
 * db.ts
 * Cliente Prisma singleton.
 *
 * Nota: o audit-extension fica DISPONÍVEL via lib/db/audit-extension mas
 * não é plugado globalmente porque quebra tipos de muitos callers. Adote
 * caso-a-caso com runWithAudit() + cliente local extended se precisar.
 */

import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient()
} else {
  const global = globalThis as any
  if (!global.prisma) {
    global.prisma = new PrismaClient()
  }
  prisma = global.prisma
}

export { prisma as db }
