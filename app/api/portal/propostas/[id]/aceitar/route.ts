/**
 * POST /api/portal/propostas/[id]/aceitar
 *
 * Cliente autenticado no portal aceita uma proposta. Dispara:
 *   1. Proposta.status = 'aceita'
 *   2. Snapshot do aceitante (nome, IP, UA, geo opcional) em observacoes
 *   3. Trigger pós-aceite: cria Contrato automaticamente (mesmo trigger
 *      usado em aprovação interna).
 *
 * Body: { aceitanteNome: string, geoLat?: number, geoLng?: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePortal } from '@/lib/portal-produtor/scope'
import { criarContratoAutoFromProposta } from '@/lib/bhgrain/contrato-auto-create'

const schema = z.object({
  aceitanteNome: z.string().min(2, 'Nome muito curto').max(200),
  geoLat: z.number().optional(),
  geoLng: z.number().optional(),
})

const STATUS_ACEITAVEIS = new Set(['enviada', 'em_negociacao'])

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
      select: { id: true, numero: true, status: true, validadeEm: true, observacoes: true },
    })

    if (!proposta) {
      return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
    }

    if (!STATUS_ACEITAVEIS.has(proposta.status)) {
      return NextResponse.json(
        { error: `Proposta não pode ser aceita (status atual: ${proposta.status})` },
        { status: 409 }
      )
    }

    if (proposta.validadeEm.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Proposta vencida' }, { status: 409 })
    }

    const ip =
      request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null
    const ua = request.headers.get('user-agent') ?? null

    const carimbo = [
      `[aceita pelo cliente em ${new Date().toISOString()}]`,
      `por: ${data.aceitanteNome}`,
      ip ? `ip: ${ip}` : null,
      ua ? `ua: ${ua.slice(0, 120)}` : null,
      data.geoLat != null && data.geoLng != null
        ? `geo: ${data.geoLat.toFixed(5)},${data.geoLng.toFixed(5)}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ')

    const novasObs = [proposta.observacoes, carimbo].filter(Boolean).join('\n').trim()

    await db.proposta.update({
      where: { id: proposta.id },
      data: {
        status: 'aceita',
        observacoes: novasObs || null,
      },
    })

    await db.auditLog
      .create({
        data: {
          userId: sess.accessId,
          workspaceId: sess.workspaceId,
          acao: 'aceita_pelo_cliente_portal',
          entidade: 'proposta',
          entidadeId: proposta.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mudancas: {
            numero: proposta.numero,
            aceitanteNome: data.aceitanteNome,
            ip,
            ua: ua?.slice(0, 200) ?? null,
          } as any,
        },
      })
      .catch(() => undefined)

    // Trigger: cria Contrato automaticamente (best-effort)
    const contrato = await criarContratoAutoFromProposta({
      propostaId: proposta.id,
      workspaceId: sess.workspaceId,
      userId: sess.accessId,
    })

    return NextResponse.json({
      ok: true,
      status: 'aceita',
      contrato,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Portal aceitar proposta error:', error)
    return NextResponse.json({ error: 'Erro ao aceitar proposta' }, { status: 500 })
  }
}
