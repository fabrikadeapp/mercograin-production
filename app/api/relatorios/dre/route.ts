import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { calcularDRE } from '@/lib/compliance/dre'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const dataInicio = searchParams.get('inicio')
  const dataFim = searchParams.get('fim')
  const safraId = searchParams.get('safraId') || undefined
  const cultura = searchParams.get('cultura') || undefined

  if (!dataInicio || !dataFim)
    return NextResponse.json(
      { error: 'inicio e fim são obrigatórios' },
      { status: 400 }
    )

  try {
    const dre = await calcularDRE({
      workspaceId: scope.workspaceId,
      inicio: new Date(dataInicio),
      fim: new Date(dataFim),
      safraId,
      cultura,
    })
    return NextResponse.json(dre)
  } catch (e: any) {
    console.error('DRE error:', e)
    return NextResponse.json({ error: 'Erro ao calcular DRE' }, { status: 500 })
  }
}
