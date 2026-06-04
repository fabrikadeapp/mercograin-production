/**
 * PATCH /api/propostas/[id]/agenda/[agendaId]
 *   Concluir/cancelar agendamento. Body: { status: 'concluido'|'cancelado', comentario?: string }
 *
 * DELETE /api/propostas/[id]/agenda/[agendaId]
 *   Remove agendamento (apenas pendentes).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

const patchSchema = z.object({
  status: z.enum(['concluido', 'cancelado']),
  comentario: z.string().max(2000).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; agendaId: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const body = await request.json().catch(() => ({}))
    const data = patchSchema.parse(body)

    const agenda = await db.propostaAgenda.findFirst({
      where: {
        id: params.agendaId,
        propostaId: params.id,
        workspaceId: scope.workspaceId,
      },
    })
    if (!agenda) {
      return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
    }
    if (agenda.status !== 'pendente') {
      return NextResponse.json(
        { error: `Agendamento já está ${agenda.status}` },
        { status: 409 }
      )
    }

    const atualizado = await db.propostaAgenda.update({
      where: { id: agenda.id },
      data: {
        status: data.status,
        concluidoEm: new Date(),
        concluidoComentario: data.comentario ?? null,
      },
    })

    return NextResponse.json({ agenda: atualizado })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('PATCH agenda error:', err)
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; agendaId: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const agenda = await db.propostaAgenda.findFirst({
      where: {
        id: params.agendaId,
        propostaId: params.id,
        workspaceId: scope.workspaceId,
      },
      select: { id: true, status: true },
    })
    if (!agenda) {
      return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
    }
    if (agenda.status !== 'pendente') {
      return NextResponse.json(
        { error: 'Só agendamentos pendentes podem ser removidos' },
        { status: 409 }
      )
    }
    await db.propostaAgenda.delete({ where: { id: agenda.id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE agenda error:', err)
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}
