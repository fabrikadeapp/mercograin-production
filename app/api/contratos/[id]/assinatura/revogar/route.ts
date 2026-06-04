/**
 * POST /api/contratos/[id]/assinatura/revogar
 *
 * Revoga (cancela) a coleta de assinatura de um contrato.
 * Só funciona se ainda não houver assinatura completa.
 *
 * Body: { motivo: string }
 *
 * Vide docs/specs/assinaturapropriaonline.md §11.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const bodySchema = z.object({
  motivo: z.string().min(5).max(500),
})

interface SignatarioStored {
  signedAt?: string | null
  tokenHash?: string | null
  [k: string]: unknown
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const scope = await getScope()
  if (!scope) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const { motivo } = parsed.data

  const contrato = await db.contrato.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    include: { assinaturaDigital: true },
  })
  if (!contrato) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const a = contrato.assinaturaDigital
  if (!a) {
    return NextResponse.json(
      { error: 'sem_coleta_de_assinatura' },
      { status: 404 },
    )
  }
  if (a.status === 'assinado') {
    return NextResponse.json({ error: 'ja_assinado' }, { status: 409 })
  }
  if (a.status === 'cancelado') {
    return NextResponse.json({
      ok: true,
      idempotente: true,
      status: 'cancelado',
    })
  }

  // Invalida tokens existentes — zera tokenHash de cada signatário não-assinado.
  // Isso faz a verificação no carregarAssinatura() retornar 'token_revogado'
  // mesmo se o token HMAC ainda estivesse válido por TTL.
  const sigs: SignatarioStored[] = Array.isArray(a.signatarios)
    ? [...(a.signatarios as SignatarioStored[])]
    : []
  for (const s of sigs) {
    if (!s.signedAt) {
      s.tokenHash = null
    }
  }

  await db.assinaturaDigital.update({
    where: { id: a.id },
    data: {
      status: 'cancelado',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signatarios: sigs as any,
      // Campos adicionados pela migration manual_assinatura_revogacao.sql
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...({
        canceladoEm: new Date(),
        canceladoPorId: scope.userId,
        canceladoMotivo: motivo,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any),
    },
  })

  // Volta contrato para 'pendente' (não está mais "enviada")
  await db.contrato.update({
    where: { id: contrato.id },
    data: { statusAssinatura: 'pendente' },
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'cancel',
    entidade: 'assinatura_digital',
    entidadeId: contrato.id,
    mudancas: {
      providerDocId: a.providerDocId,
      motivo,
      contratoNumero: contrato.numero,
    },
  })

  return NextResponse.json({ ok: true, status: 'cancelado' })
}
