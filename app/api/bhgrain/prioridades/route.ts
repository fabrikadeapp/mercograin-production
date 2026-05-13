/**
 * GET /api/bhgrain/prioridades
 *
 * Retorna top-5 ações priorizadas para o dia. Multi-tenant via requireScope.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { priorizarDia, type PropostaContexto } from '@/lib/bhgrain/priorizacao'

export const dynamic = 'force-dynamic'

const STATUS_ABERTOS = ['rascunho', 'rascunho_ia', 'pendente', 'pronta_para_enviar', 'enviada', 'em_negociacao']

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await requireScope(searchParams)

    const propostas = await db.proposta.findMany({
      where: { workspaceId: scope.workspaceId, status: { in: STATUS_ABERTOS } },
      take: 300,
      include: { cliente: { select: { nome: true } } },
    })

    const agora = Date.now()
    const contexto: PropostaContexto[] = propostas.map((p) => {
      const g = p.graos as { commodity?: string } | null
      return {
        id: p.id,
        clienteNome: p.cliente.nome,
        commodity: g?.commodity ?? '—',
        valorTotal: Number(p.valorTotal),
        status: p.status,
        score: p.scoreInterno,
        margemPercent: p.margemPercent != null ? Number(p.margemPercent) : null,
        margemMinima: null,
        validadeCotacaoRestanteMin: p.validadeCotacao ? Math.round((p.validadeCotacao.getTime() - agora) / 60000) : null,
        horasSemResposta: p.enviadaEm ? (agora - p.enviadaEm.getTime()) / 3600000 : null,
      }
    })

    const limit = Math.min(20, Math.max(1, Number(searchParams.get('limit') ?? '5')))
    const prioridades = priorizarDia(contexto, limit)
    return NextResponse.json({ prioridades })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const status = msg === 'Não autorizado' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
