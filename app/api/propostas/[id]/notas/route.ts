/**
 * GET  /api/propostas/[id]/notas — lista notas (mais recentes primeiro).
 * POST /api/propostas/[id]/notas — cria nota livre.
 *
 * Body POST:
 *   { texto: string (3..2000), categoria?: 'conversa'|'objecao'|'concorrencia'|'oportunidade'|'outro' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit/log'

const CATEGORIAS = ['conversa', 'objecao', 'concorrencia', 'oportunidade', 'outro'] as const

const postSchema = z.object({
  texto: z.string().min(3, 'Texto muito curto').max(2000),
  categoria: z.enum(CATEGORIAS).optional(),
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

    const notas = await db.propostaNota.findMany({
      where: { propostaId: proposta.id, workspaceId: scope.workspaceId },
      orderBy: { criadaEm: 'desc' },
      take: 100,
    })

    return NextResponse.json({ notas })
  } catch (err) {
    console.error('GET notas error:', err)
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

    const proposta = await db.proposta.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      select: { id: true, numero: true },
    })
    if (!proposta) {
      return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
    }

    const user = await db.user.findUnique({
      where: { id: scope.userId },
      select: { nome: true, email: true },
    })

    const nota = await db.propostaNota.create({
      data: {
        propostaId: proposta.id,
        workspaceId: scope.workspaceId,
        texto: data.texto,
        autorId: scope.userId,
        autorNome: user?.nome ?? user?.email ?? null,
        categoria: data.categoria ?? null,
      },
    })

    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'proposta_nota_criada',
      entidade: 'proposta',
      entidadeId: proposta.id,
      mudancas: {
        numero: proposta.numero,
        notaId: nota.id,
        categoria: data.categoria ?? null,
        previewTexto: data.texto.slice(0, 80),
      },
    }).catch(() => undefined)

    return NextResponse.json({ nota }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('POST nota error:', err)
    return NextResponse.json({ error: 'Erro ao criar nota' }, { status: 500 })
  }
}
