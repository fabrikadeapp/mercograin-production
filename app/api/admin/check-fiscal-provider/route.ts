/**
 * TEMPORÁRIO — diagnosticar provider signature por workspace.
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
  const cfgs = await db.configuracaoFiscal.findMany({
    select: {
      workspaceId: true,
      providerNome: true,
      workspace: { select: { name: true, slug: true } },
    },
  })
  return NextResponse.json({ ok: true, count: cfgs.length, cfgs })
}
