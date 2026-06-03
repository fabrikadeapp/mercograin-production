/**
 * POST /api/propostas/[id]/marcar-perdida
 * Marca proposta como perdida com motivo (lossReason). Status → 'perdida'.
 *
 * Body:
 *   { lossReason: string, observacoes?: string }
 *
 * lossReason: 'preco' | 'concorrencia' | 'prazo' | 'qualidade' | 'logistica' | 'sem_resposta' | 'outro'
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit/log'
import { revalidateTag } from 'next/cache'

const LOSS_REASONS = [
  'preco',
  'concorrencia',
  'prazo',
  'qualidade',
  'logistica',
  'sem_resposta',
  'outro',
] as const

const schema = z.object({
  lossReason: z.enum(LOSS_REASONS),
  observacoes: z.string().max(500).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const data = schema.parse(body)

    const proposta = await db.proposta.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      select: { id: true, numero: true, status: true, observacoes: true },
    })

    if (!proposta) {
      return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
    }

    if (proposta.status === 'sucesso' || proposta.status === 'fechado' || proposta.status === 'faturado') {
      return NextResponse.json(
        { error: 'Não é possível marcar como perdida uma proposta já fechada' },
        { status: 409 }
      )
    }

    const novasObs = [
      proposta.observacoes,
      data.observacoes ? `[perdida — motivo: ${data.lossReason}] ${data.observacoes}` : null,
    ]
      .filter(Boolean)
      .join('\n')
      .trim()

    const atualizada = await db.proposta.update({
      where: { id: proposta.id },
      data: {
        status: 'perdida',
        lossReason: data.lossReason,
        observacoes: novasObs || null,
      },
      select: { id: true, numero: true, status: true, lossReason: true },
    })

    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'marcar_perdida',
      entidade: 'proposta',
      entidadeId: atualizada.id,
      mudancas: {
        numero: atualizada.numero,
        statusAnterior: proposta.status,
        statusNovo: 'perdida',
        lossReason: data.lossReason,
      },
    })

    revalidateTag('propostas')

    return NextResponse.json(atualizada)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Marcar perdida error:', error)
    return NextResponse.json({ error: 'Erro ao marcar como perdida' }, { status: 500 })
  }
}
