/**
 * POST /api/portal/propostas/[id]/rejeitar
 *
 * Cliente autenticado no portal recusa uma proposta.
 *   - Proposta.status = 'recusada'
 *   - Carimbo de motivo + IP + UA em observacoes
 *
 * Body: { motivo: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePortal } from '@/lib/portal-produtor/scope'

const schema = z.object({
  motivo: z.string().min(3, 'Motivo muito curto').max(500),
})

const STATUS_RECUSAVEIS = new Set(['enviada', 'em_negociacao'])

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sess = await requirePortal()
    if (!sess) {
      return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const data = schema.parse(body)

    const proposta = await db.proposta.findFirst({
      where: {
        id: params.id,
        clienteId: sess.clienteId,
        workspaceId: sess.workspaceId,
      },
      select: { id: true, numero: true, status: true, observacoes: true },
    })

    if (!proposta) {
      return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
    }

    if (!STATUS_RECUSAVEIS.has(proposta.status)) {
      return NextResponse.json(
        { error: `Proposta não pode ser recusada (status atual: ${proposta.status})` },
        { status: 409 }
      )
    }

    const ip =
      request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null
    const carimbo = `[recusada pelo cliente em ${new Date().toISOString()}] motivo: ${data.motivo}${ip ? ` · ip: ${ip}` : ''}`
    const novasObs = [proposta.observacoes, carimbo].filter(Boolean).join('\n').trim()

    await db.proposta.update({
      where: { id: proposta.id },
      data: {
        status: 'recusada',
        lossReason: 'sem_resposta', // genérico; equipe edita depois se quiser
        observacoes: novasObs,
      },
    })

    await db.auditLog
      .create({
        data: {
          userId: sess.accessId,
          workspaceId: sess.workspaceId,
          acao: 'recusada_pelo_cliente_portal',
          entidade: 'proposta',
          entidadeId: proposta.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mudancas: {
            numero: proposta.numero,
            motivo: data.motivo,
            ip,
          } as any,
        },
      })
      .catch(() => undefined)

    return NextResponse.json({ ok: true, status: 'recusada' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Portal rejeitar proposta error:', error)
    return NextResponse.json({ error: 'Erro ao recusar proposta' }, { status: 500 })
  }
}
