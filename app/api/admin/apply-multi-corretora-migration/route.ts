/**
 * TEMPORÁRIO — drop emailLogin global unique + cria unique composto.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STMTS = [
  `ALTER TABLE "ProdutorAccess" DROP CONSTRAINT IF EXISTS "ProdutorAccess_emailLogin_key"`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ProdutorAccess_workspaceId_emailLogin_key" ON "ProdutorAccess"("workspaceId", "emailLogin")`,
  `CREATE INDEX IF NOT EXISTS "ProdutorAccess_emailLogin_idx" ON "ProdutorAccess"("emailLogin")`,
]

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    for (const s of STMTS) await db.$executeRawUnsafe(s)
    return NextResponse.json({ ok: true, aplicados: STMTS.length })
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'erro' },
      { status: 500 },
    )
  }
}
