import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { resolveMesaScope, wherePropostaMesa } from '@/lib/equipe/scope-mesa'

export const dynamic = 'force-dynamic'

/**
 * GET /api/bhgrain/propostas-aguardando
 *
 * Lista propostas que ainda não foram enviadas (status='rascunho') ou que
 * estão aguardando autorização da Laura.IA por canal externo
 * (status='aguardando_autorizacao'). Aplicada visibilidade da Mesa.
 *
 * Retorno limitado a 20 itens — UI mostra 6 + "ver tudo".
 */
export async function GET() {
  const scope = await getScope()
  if (!scope) {
    return NextResponse.json({ items: [], count: 0 }, { status: 200 })
  }

  const mesa = await resolveMesaScope(scope)
  const mesaFilter = wherePropostaMesa(mesa)

  const where: any = {
    ...scope.whereOwn(),
    status: { in: ['rascunho', 'aguardando_autorizacao'] },
  }
  if (mesaFilter && Object.keys(mesaFilter).length > 0) {
    where.AND = [mesaFilter]
  }

  try {
    const [propostas, count] = await Promise.all([
      db.proposta.findMany({
        where,
        select: {
          id: true,
          numero: true,
          status: true,
          valorTotal: true,
          canalAutorizacao: true,
          criadaEm: true,
          cliente: { select: { nome: true } },
        },
        orderBy: [
          // Aguardando autorização (Laura.IA) primeiro — mais urgente
          { status: 'asc' }, // 'aguardando_autorizacao' < 'rascunho' alfabético
          { criadaEm: 'desc' },
        ],
        take: 20,
      }),
      db.proposta.count({ where }),
    ])

    return NextResponse.json({
      items: propostas.map((p) => ({
        id: p.id,
        numero: p.numero,
        clienteNome: p.cliente?.nome ?? '—',
        valorTotal: Number(p.valorTotal),
        status: p.status,
        canalAutorizacao: p.canalAutorizacao,
        criadaEm: p.criadaEm.toISOString(),
      })),
      count,
    })
  } catch (err) {
    console.error('[bhgrain/propostas-aguardando]', err)
    return NextResponse.json({ items: [], count: 0 })
  }
}
