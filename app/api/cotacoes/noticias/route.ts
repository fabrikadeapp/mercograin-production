/**
 * GET /api/cotacoes/noticias
 * TODO: integrar com fonte de notícias real (CEPEA / Reuters / Bloomberg).
 * Hoje: retorna mock server-side. Frontend já está pronto pra dado real.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

const MOCK_NEWS = [
  { id: 'n1', meta: 'há 7 min · CEPEA', title: 'USDA revisa estoque global de soja para 122,4 Mt' },
  { id: 'n2', meta: 'há 14 min · CEPEA', title: 'China retoma compras após feriado da Lua' },
  { id: 'n3', meta: 'há 21 min · CEPEA', title: 'Estiagem no MT pressiona prêmio FOB Paranaguá' },
  { id: 'n4', meta: 'há 28 min · CEPEA', title: 'Dólar fecha em queda com fluxo cambial positivo' },
]

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  return NextResponse.json({
    items: [],
    fonte: 'em_breve',
    comingSoon: true,
    descricaoFutura: 'Notícias CEPEA/Reuters/Bloomberg em breve.',
  })
}
