/**
 * PATCH /api/propostas/[id]/status
 *
 * Mudança manual de status da proposta pelo operador, com validação
 * de transição legal (lib/propostas/transicoes.ts).
 *
 * Body:
 *   {
 *     status: PropostaStatus,
 *     lossReason?: LossReason,       // obrigatório se status='perdida'
 *     comentario?: string,           // opcional, vai pra audit + nota
 *   }
 *
 * Audit log: 'proposta_status_alterado' com de/para + comentario.
 *
 * GET /api/propostas/[id]/status
 * Retorna { atual, destinosValidos } para popular dropdown na UI.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit/log'
import {
  destinosValidos,
  validarTransicao,
  LOSS_REASONS,
} from '@/lib/propostas/transicoes'
import { PROPOSTA_STATUS } from '@/lib/propostas/status'

const schema = z.object({
  status: z.string().min(1),
  lossReason: z.enum(LOSS_REASONS).optional(),
  comentario: z.string().max(500).optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const proposta = await db.proposta.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      select: { status: true },
    })
    if (!proposta) {
      return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
    }
    return NextResponse.json({
      atual: proposta.status,
      destinosValidos: destinosValidos(proposta.status),
      lossReasons: LOSS_REASONS,
    })
  } catch (err) {
    console.error('GET status error:', err)
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const data = schema.parse(body)

    const proposta = await db.proposta.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      select: {
        id: true,
        numero: true,
        status: true,
        observacoes: true,
      },
    })
    if (!proposta) {
      return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
    }

    // Valida transição
    const v = validarTransicao(proposta.status, data.status, {
      lossReason: data.lossReason ?? null,
    })
    if (!v.ok) {
      return NextResponse.json(
        {
          error: v.motivo,
          statusAtual: proposta.status,
          destinosValidos: destinosValidos(proposta.status),
        },
        { status: 409 }
      )
    }

    // Atualização: encadeia campos especiais por status destino
    const novosCampos: Record<string, unknown> = {
      status: data.status.toLowerCase(),
    }

    if (data.status.toLowerCase() === PROPOSTA_STATUS.ENVIADA && !proposta) {
      // (no-op aqui pra evitar bug de tslint)
    }

    if (data.status.toLowerCase() === PROPOSTA_STATUS.PERDIDA) {
      novosCampos.lossReason = data.lossReason
      const carimbo = `[perdida — motivo: ${data.lossReason}]${
        data.comentario ? ` ${data.comentario}` : ''
      }`
      novosCampos.observacoes = [proposta.observacoes, carimbo]
        .filter(Boolean)
        .join('\n')
        .trim()
    }

    // Quando mudar para enviada, preencher enviadaEm se ainda não estiver
    if (data.status.toLowerCase() === PROPOSTA_STATUS.ENVIADA) {
      novosCampos.enviadaEm = new Date()
    }

    await db.proposta.update({
      where: { id: proposta.id },
      data: novosCampos,
    })

    // Audit
    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'proposta_status_alterado',
      entidade: 'proposta',
      entidadeId: proposta.id,
      mudancas: {
        numero: proposta.numero,
        statusAnterior: proposta.status,
        statusNovo: data.status.toLowerCase(),
        lossReason: data.lossReason ?? null,
        comentario: data.comentario ?? null,
      },
    }).catch(() => undefined)

    // Se há comentário, cria também uma nota automaticamente
    if (data.comentario && data.comentario.trim().length >= 3) {
      const userInfo = await db.user.findUnique({
        where: { id: scope.userId },
        select: { nome: true, email: true },
      })
      await db.propostaNota
        .create({
          data: {
            propostaId: proposta.id,
            workspaceId: scope.workspaceId,
            texto: `[status: ${proposta.status} → ${data.status.toLowerCase()}] ${data.comentario}`,
            autorId: scope.userId,
            autorNome: userInfo?.nome ?? userInfo?.email ?? null,
            categoria: 'outro',
          },
        })
        .catch(() => undefined)
    }

    revalidateTag('propostas')

    return NextResponse.json({
      ok: true,
      statusAnterior: proposta.status,
      statusNovo: data.status.toLowerCase(),
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('PATCH status error:', err)
    return NextResponse.json({ error: 'Erro ao mudar status' }, { status: 500 })
  }
}
