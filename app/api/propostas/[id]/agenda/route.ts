/**
 * GET  /api/propostas/[id]/agenda — lista agendamentos (pendentes primeiro).
 * POST /api/propostas/[id]/agenda — cria agendamento de próximo contato.
 *
 * Body POST:
 *   {
 *     titulo: string,
 *     descricao?: string,
 *     agendadoPara: ISO datetime,
 *     responsavelId?: string (default = scope.userId)
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit/log'

const postSchema = z.object({
  titulo: z.string().min(3, 'Título obrigatório').max(200),
  descricao: z.string().max(2000).optional(),
  agendadoPara: z.string().min(1, 'agendadoPara obrigatório'),
  responsavelId: z.string().optional(),
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
      select: { id: true },
    })
    if (!proposta) {
      return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
    }

    const agendamentos = await db.propostaAgenda.findMany({
      where: { propostaId: proposta.id, workspaceId: scope.workspaceId },
      orderBy: [{ status: 'asc' }, { agendadoPara: 'asc' }],
      take: 100,
    })

    return NextResponse.json({ agendamentos })
  } catch (err) {
    console.error('GET agenda error:', err)
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const data = postSchema.parse(body)

    const agendadoParaDate = new Date(data.agendadoPara)
    if (isNaN(agendadoParaDate.getTime())) {
      return NextResponse.json({ error: 'agendadoPara inválido' }, { status: 400 })
    }

    const proposta = await db.proposta.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      select: { id: true, numero: true },
    })
    if (!proposta) {
      return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
    }

    const responsavelId = data.responsavelId ?? scope.userId
    const user = await db.user.findUnique({
      where: { id: responsavelId },
      select: { nome: true, email: true },
    })

    const agenda = await db.propostaAgenda.create({
      data: {
        propostaId: proposta.id,
        workspaceId: scope.workspaceId,
        titulo: data.titulo,
        descricao: data.descricao ?? null,
        agendadoPara: agendadoParaDate,
        responsavelId,
        responsavelNome: user?.nome ?? user?.email ?? null,
        status: 'pendente',
      },
    })

    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'proposta_agenda_criada',
      entidade: 'proposta',
      entidadeId: proposta.id,
      mudancas: {
        numero: proposta.numero,
        agendaId: agenda.id,
        titulo: data.titulo,
        agendadoPara: data.agendadoPara,
      },
    }).catch(() => undefined)

    return NextResponse.json({ agenda }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('POST agenda error:', err)
    return NextResponse.json({ error: 'Erro ao criar agendamento' }, { status: 500 })
  }
}
