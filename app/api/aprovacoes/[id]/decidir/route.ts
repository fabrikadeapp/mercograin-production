import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  processarDecisao,
  podeAprovarEtapa,
  AprovacaoEtapa,
} from '@/lib/compliance/aprovacao'
import {
  ativarEntidadeAprovada,
  rejeitarEntidade,
} from '@/lib/compliance'

const decidirSchema = z.object({
  decisao: z.enum(['aprovado', 'rejeitado']),
  motivo: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const scope = await getScope()
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const data = decidirSchema.parse(body)

    const aprovacao = await db.aprovacao.findFirst({
      where: { id, ...scope.whereOwn() },
      include: { workflow: true, decisoes: true },
    })
    if (!aprovacao)
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    if (aprovacao.status !== 'pendente')
      return NextResponse.json(
        { error: 'Aprovação não está pendente' },
        { status: 400 }
      )

    const etapas = (aprovacao.workflow.etapas as any[]) as AprovacaoEtapa[]
    const etapaCorrente = etapas.find((e) => e.ordem === aprovacao.etapaAtual)
    if (!etapaCorrente)
      return NextResponse.json(
        { error: 'Etapa atual mal configurada' },
        { status: 500 }
      )

    if (!podeAprovarEtapa(etapaCorrente, scope.workspaceRole) && !scope.isAdmin) {
      return NextResponse.json(
        { error: 'Sem permissão para aprovar esta etapa' },
        { status: 403 }
      )
    }

    // Calcula novo status
    const novo = processarDecisao(
      { etapas, slaHoras: aprovacao.workflow.slaHoras },
      {
        etapaAtual: aprovacao.etapaAtual,
        totalEtapas: aprovacao.totalEtapas,
        decisoes: aprovacao.decisoes,
      },
      {
        aprovacaoId: aprovacao.id,
        etapa: aprovacao.etapaAtual,
        aprovadorId: scope.userId,
        decisao: data.decisao,
        motivo: data.motivo,
      }
    )

    // Persiste decisão + atualiza aprovação
    await db.$transaction(async (tx) => {
      await tx.aprovacaoDecisao.create({
        data: {
          aprovacaoId: aprovacao.id,
          etapa: aprovacao.etapaAtual,
          aprovadorId: scope.userId,
          decisao: data.decisao,
          motivo: data.motivo,
        },
      })

      await tx.aprovacao.update({
        where: { id: aprovacao.id },
        data: {
          status: novo.status,
          etapaAtual: novo.proximaEtapa ?? aprovacao.etapaAtual,
          prazoEtapaAtual: novo.prazoEtapaAtual,
        },
      })
    })

    // Callback nas entidades reais
    if (novo.status === 'aprovada') {
      await ativarEntidadeAprovada(aprovacao.entidadeTipo, aprovacao.entidadeId)
    } else if (novo.status === 'rejeitada') {
      await rejeitarEntidade(aprovacao.entidadeTipo, aprovacao.entidadeId)
    }

    return NextResponse.json({
      ok: true,
      status: novo.status,
      etapaAtual: novo.proximaEtapa ?? aprovacao.etapaAtual,
    })
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
    }
    console.error('Decidir aprovação error:', e)
    return NextResponse.json(
      { error: 'Erro ao decidir aprovação' },
      { status: 500 }
    )
  }
}
