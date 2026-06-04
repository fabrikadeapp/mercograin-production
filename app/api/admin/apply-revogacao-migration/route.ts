/**
 * Endpoint TEMPORÁRIO — aplica migration manual_assinatura_revogacao.sql.
 * Deve ser removido após uso.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SQL = `
ALTER TABLE "AssinaturaDigital"
  ADD COLUMN IF NOT EXISTS "canceladoEm"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "canceladoPorId"  TEXT,
  ADD COLUMN IF NOT EXISTS "canceladoMotivo" TEXT;
`.trim()

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    await db.$executeRawUnsafe(SQL)
    return NextResponse.json({ ok: true, applied: 'manual_assinatura_revogacao.sql' })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'erro' },
      { status: 500 },
    )
  }
}
