/**
 * PATCH /api/negocios/[id] — move estágio do negócio (deal flow).
 * Body: { estagio } — registra data/responsável e adiciona ao histórico.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ESTAGIOS = ['captado', 'match', 'negociacao', 'fechado', 'embarque', 'liquidacao', 'comissao_recebida', 'cancelado'] as const

const schema = z.object({ estagio: z.enum(ESTAGIOS) })

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const negocio = await db.negocio.findFirst({ where: { id: params.id, ...scope.whereOwn() }, select: { id: true, estagio: true, historico: true } })
  if (!negocio) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const hist = Array.isArray(negocio.historico) ? (negocio.historico as any[]) : []
  hist.push({ estagio: parsed.data.estagio, em: new Date().toISOString(), por: scope.userId })

  await db.negocio.update({
    where: { id: params.id },
    data: { estagio: parsed.data.estagio, estagioMudadoEm: new Date(), responsavelId: scope.userId, historico: hist },
  })

  await logAudit({
    userId: scope.userId, workspaceId: scope.workspaceId, acao: 'negocio_estagio',
    entidade: 'negocio', entidadeId: params.id,
    mudancas: { de: negocio.estagio, para: parsed.data.estagio },
  }).catch(() => undefined)

  return NextResponse.json({ ok: true })
}
