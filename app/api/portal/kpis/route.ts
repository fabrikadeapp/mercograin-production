import { NextResponse } from 'next/server'
import { requirePortal } from '@/lib/portal-produtor/scope'
import { kpisProdutor } from '@/lib/bi/produtor'

export async function GET() {
  const scope = await requirePortal()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const kpis = await kpisProdutor(scope.clienteId)
    return NextResponse.json({ kpis })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro' }, { status: 500 })
  }
}
