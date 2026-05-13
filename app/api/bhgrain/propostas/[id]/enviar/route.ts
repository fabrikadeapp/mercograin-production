/**
 * POST /api/bhgrain/propostas/[id]/enviar
 *
 * Aplica enforcement de CommercialRule antes de mudar status para 'enviada'.
 *  - bloqueado → 409 Conflict com motivos
 *  - aprovacao → 202 Accepted + cria Aprovacao + status 'pendente_aprovacao'
 *  - permitido → status 'enviada' + enviadaEm
 *
 * Permissão: send_proposal.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireBhGrainScope } from '@/lib/bhgrain/scope-permissions'
import { enforceRegrasEnvio } from '@/lib/bhgrain/regras-enforce'
import { abrirAprovacao } from '@/lib/bhgrain/proposta-approval'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireBhGrainScope()
    scope.require('send_proposal')
    const { id } = await params

    // Valida proposta pertence ao workspace
    const p = await db.proposta.findFirst({
      where: { id, workspaceId: scope.workspaceId },
      select: { id: true, status: true },
    })
    if (!p) return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })

    // Enforcement
    const result = await enforceRegrasEnvio(id, scope.workspaceId)

    if (result.decisao === 'bloqueado') {
      await db.auditLog.create({
        data: {
          userId: scope.userId,
          acao: 'Envio bloqueado por regra comercial',
          entidade: 'Proposta',
          entidadeId: id,
          workspaceId: scope.workspaceId,
          mudancas: { motivos: result.motivos, regras: result.regras },
        },
      })
      return NextResponse.json(
        { decisao: 'bloqueado', motivos: result.motivos, regras: result.regras },
        { status: 409 }
      )
    }

    if (result.decisao === 'aprovacao') {
      const ap = await abrirAprovacao({
        propostaId: id,
        workspaceId: scope.workspaceId,
        solicitanteId: scope.userId,
        motivos: result.motivos,
        regrasAplicadasIds: result.regras,
        workflow: { etapas: [{ ordem: 1, role: 'gestor', nome: 'Aprovação por regra' }], slaHoras: 24 },
      })
      // Marca status como pendente_aprovacao
      await db.proposta.update({
        where: { id },
        data: { status: 'pendente_aprovacao' },
      })
      return NextResponse.json(
        { decisao: 'aprovacao', aprovacaoId: ap.aprovacaoId, motivos: result.motivos },
        { status: 202 }
      )
    }

    // Permitido — envia
    await db.proposta.update({
      where: { id },
      data: { status: 'enviada', enviadaEm: new Date() },
    })
    await db.auditLog.create({
      data: {
        userId: scope.userId,
        acao: 'Proposta enviada',
        entidade: 'Proposta',
        entidadeId: id,
        workspaceId: scope.workspaceId,
      },
    })
    return NextResponse.json({ decisao: 'permitido', enviada: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const status = msg.includes('autoriz') ? 401 : msg.includes('Acesso') || msg.includes('Permissão') ? 403 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
