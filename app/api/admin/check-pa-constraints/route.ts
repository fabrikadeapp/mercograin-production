import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({}, { status: 401 })
  const rows = await db.$queryRawUnsafe<unknown[]>(
    `SELECT conname, contype, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conrelid = '"ProdutorAccess"'::regclass`,
  )
  const idx = await db.$queryRawUnsafe<unknown[]>(
    `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'ProdutorAccess'`,
  )
  return NextResponse.json({ constraints: rows, indexes: idx })
}
