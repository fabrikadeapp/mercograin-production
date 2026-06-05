import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({}, { status: 401 })
  }
  await db.$executeRawUnsafe(`DROP INDEX IF EXISTS "ProdutorAccess_emailLogin_key"`)
  return NextResponse.json({ ok: true })
}
