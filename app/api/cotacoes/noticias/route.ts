/**
 * GET /api/cotacoes/noticias
 * Não implementado — integração CEPEA/Reuters/Bloomberg é roadmap.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  return NextResponse.json(
    {
      disponivel: false,
      motivo: 'Integração CEPEA/Reuters em desenvolvimento.',
    },
    { status: 410 },
  )
}
