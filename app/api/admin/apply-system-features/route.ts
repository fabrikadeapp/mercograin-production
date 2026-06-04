/**
 * TEMPORÁRIO — cria tabela SystemFeatureFlag + seed inicial.
 * Authorization: Bearer ${CRON_SECRET}
 *
 * Política aplicada: todas opcionais OFF, exceto portal_produtor ON.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SQL = [
  `CREATE TABLE IF NOT EXISTS "SystemFeatureFlag" (
    "id" TEXT PRIMARY KEY,
    "feature" VARCHAR(60) NOT NULL UNIQUE,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "toggledAt" TIMESTAMP(3),
    "toggledBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
]

const SEED: Array<{ feature: string; enabled: boolean }> = [
  { feature: 'originacao', enabled: false },
  { feature: 'eudr', enabled: false },
  { feature: 'hedge', enabled: false },
  { feature: 'portal_produtor', enabled: true },
  { feature: 'logistica', enabled: false },
  { feature: 'marketplace', enabled: false },
  { feature: 'laura_ai', enabled: false },
  { feature: 'classificados', enabled: false },
]

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    for (const s of SQL) await db.$executeRawUnsafe(s)
    let seeded = 0
    for (const s of SEED) {
      await db.systemFeatureFlag.upsert({
        where: { feature: s.feature },
        create: {
          feature: s.feature,
          enabled: s.enabled,
          toggledAt: new Date(),
          toggledBy: 'seed',
        },
        update: {}, // não sobrescreve estado já configurado
      })
      seeded++
    }
    return NextResponse.json({ ok: true, seeded })
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'erro' },
      { status: 500 },
    )
  }
}
