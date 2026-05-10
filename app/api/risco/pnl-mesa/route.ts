import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { calcularPnLPorMesa } from '@/lib/risco/pnl-hierarquico'

export async function GET(req: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const de = searchParams.get('de')
  const ate = searchParams.get('ate')
  const periodo = de && ate ? { de: new Date(de), ate: new Date(ate) } : undefined
  const data = await calcularPnLPorMesa(scope.workspaceId, periodo)
  return NextResponse.json({ data })
}
