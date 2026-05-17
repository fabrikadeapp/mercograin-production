/**
 * GET /api/dashboard/demanda-exportacao
 * Demanda global por destino (top 5).
 *
 * TODO: integrar com fonte oficial (CONAB / MAPA / SECEX).
 * Por enquanto, retorna mock server-side estável para o dashboard.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'

const MOCK_DEMAND = [
  { label: 'China', value: '58.420 t', amount: 58420, color: 'var(--neg)' },
  { label: 'União Europeia', value: '24.180 t', amount: 24180, color: 'var(--warn)' },
  { label: 'Argentina', value: '18.950 t', amount: 18950, color: 'var(--info)' },
  { label: 'Estados Unidos', value: '12.430 t', amount: 12430, color: 'var(--accent)' },
  { label: 'Índia', value: '8.610 t', amount: 8610, color: 'var(--grain-milho)' },
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  return NextResponse.json({
    items: [],
    totalToneladas: 0,
    fonte: 'em_breve',
    comingSoon: true,
    descricaoFutura: 'Integração com CONAB/MAPA/SECEX em breve.',
  })
}
