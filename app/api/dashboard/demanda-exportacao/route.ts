/**
 * GET /api/dashboard/demanda-exportacao
 * Demanda global por destino.
 *
 * Não implementado — integrações CONAB/MAPA/SECEX são roadmap.
 * Retorna 410 Gone para o frontend não renderizar widget vazio.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  return NextResponse.json(
    {
      disponivel: false,
      motivo:
        'Integração CONAB/MAPA/SECEX em desenvolvimento. Widget desabilitado.',
    },
    { status: 410 },
  )
}
