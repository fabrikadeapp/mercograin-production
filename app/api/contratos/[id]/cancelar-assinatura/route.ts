/**
 * POST /api/contratos/[id]/cancelar-assinatura
 * Body: { motivo: string }
 *
 * Cancela o fluxo de assinatura no provider e marca AssinaturaDigital.status='cancelado'.
 * Restaura Contrato.statusAssinatura='pendente' (permite re-envio).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { getSignatureProvider } from '@/lib/contratos/signature'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const bodySchema = z.object({
  motivo: z.string().min(3).max(500),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_body', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const contrato = await db.contrato.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: { assinaturaDigital: true },
    })
    if (!contrato) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    const ass = contrato.assinaturaDigital
    if (!ass) {
      return NextResponse.json(
        { error: 'sem_fluxo_de_assinatura' },
        { status: 400 }
      )
    }
    if (ass.status === 'assinado') {
      return NextResponse.json(
        { error: 'ja_assinado_nao_cancelavel' },
        { status: 409 }
      )
    }

    const provider = await getSignatureProvider(scope.workspaceId)
    if (provider.name !== ass.providerNome) {
      console.warn(
        `[cancelar-assinatura] provider atual (${provider.name}) difere do que enviou (${ass.providerNome})`
      )
    }

    let providerError: string | undefined
    try {
      const r = await provider.cancel(ass.providerDocId, parsed.data.motivo)
      if (!r.ok) providerError = r.error
    } catch (e: any) {
      providerError = e?.message
    }

    await db.$transaction([
      db.assinaturaDigital.update({
        where: { id: ass.id },
        data: { status: 'cancelado', finalizadoEm: new Date() },
      }),
      db.contrato.update({
        where: { id: contrato.id },
        data: { statusAssinatura: 'pendente' },
      }),
    ])

    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'update',
      entidade: 'assinatura_digital',
      entidadeId: contrato.id,
      mudancas: { motivo: parsed.data.motivo, providerError },
    })

    return NextResponse.json({ ok: true, providerError: providerError || null })
  } catch (e: any) {
    console.error('[cancelar-assinatura]', e)
    return NextResponse.json(
      { error: e?.message || 'internal_error' },
      { status: 500 }
    )
  }
}
