/**
 * POST /api/bhgrain/propostas/[id]/aprovar
 * Body: { acao: 'abrir' | 'aprovar' | 'rejeitar', motivo?: string, aprovacaoId?: string }
 *
 * 'abrir' — avalia regras e cria Aprovacao se necessário (idempotente)
 * 'aprovar' — registra decisão positiva na aprovação pendente da proposta
 * 'rejeitar' — registra decisão negativa
 *
 * Permissão: edit_proposal para 'abrir', approve_proposal para 'aprovar'/'rejeitar'
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireBhGrainScope } from '@/lib/bhgrain/scope-permissions'
import { avaliarAprovacao, abrirAprovacao, decidirAprovacao } from '@/lib/bhgrain/proposta-approval'
import { db } from '@/lib/db'
import { criarContratoAutoFromProposta } from '@/lib/bhgrain/contrato-auto-create'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireBhGrainScope()
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as {
      acao?: 'abrir' | 'aprovar' | 'rejeitar'
      motivo?: string
    }

    if (body.acao === 'abrir') {
      scope.require('edit_proposal')
      const aval = await avaliarAprovacao(id, scope.workspaceId)
      if (!aval.precisa) {
        return NextResponse.json({ ok: true, precisa: false, motivos: [] })
      }
      const r = await abrirAprovacao({
        propostaId: id,
        workspaceId: scope.workspaceId,
        solicitanteId: scope.userId,
        motivos: aval.motivos,
        regrasAplicadasIds: aval.regrasAplicadas.map((r) => r.id),
        workflow: aval.workflowSugerido ?? { etapas: [{ ordem: 1, role: 'gestor', nome: 'Aprovação' }], slaHoras: 48 },
      })
      return NextResponse.json({ ok: true, precisa: true, ...r, motivos: aval.motivos })
    }

    if (body.acao === 'aprovar' || body.acao === 'rejeitar') {
      scope.require('approve_proposal')
      const aprov = await db.aprovacao.findFirst({
        where: {
          workspaceId: scope.workspaceId,
          entidadeTipo: 'Proposta',
          entidadeId: id,
          status: 'pendente',
        },
        select: { id: true },
      })
      if (!aprov) throw new Error('Sem aprovação pendente para esta proposta')

      const r = await decidirAprovacao({
        aprovacaoId: aprov.id,
        workspaceId: scope.workspaceId,
        aprovadorId: scope.userId,
        decisao: body.acao === 'aprovar' ? 'aprovado' : 'rejeitado',
        motivo: body.motivo,
      })

      // Trigger: aprovação concluída → cria contrato automaticamente.
      // Best-effort: erros não falham a aprovação.
      let contrato: Awaited<ReturnType<typeof criarContratoAutoFromProposta>> = null
      if (r.status === 'aprovada') {
        contrato = await criarContratoAutoFromProposta({
          propostaId: id,
          workspaceId: scope.workspaceId,
          userId: scope.userId,
          origin: request.headers.get('origin') ?? request.nextUrl.origin,
        })
      }

      return NextResponse.json({ ok: true, ...r, contrato })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const status = msg.includes('autoriz') ? 401 : msg.includes('Acesso') || msg.includes('Permissão') ? 403 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
