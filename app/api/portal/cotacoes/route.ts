import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePortal } from '@/lib/portal-produtor/scope'

export async function GET() {
  const scope = await requirePortal()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  // últimas cotações por grão — view-only
  const cotacoes = await db.cotacao.findMany({
    orderBy: { data: 'desc' },
    take: 30,
  })
  return NextResponse.json({ cotacoes })
}
