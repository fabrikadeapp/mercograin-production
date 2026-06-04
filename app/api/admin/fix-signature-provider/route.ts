/**
 * TEMPORÁRIO — força provider native em todos os workspaces.
 * Authorization: Bearer ${CRON_SECRET}
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const r = await db.configuracaoFiscal.updateMany({
    where: { providerNome: 'mock' },
    data: { providerNome: 'native' },
  })
  return NextResponse.json({ ok: true, atualizados: r.count })
}
