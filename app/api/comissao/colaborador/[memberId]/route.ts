/**
 * Regra de comissão de um colaborador. Feature-gated por 'comissionamento'.
 *
 * GET   /api/comissao/colaborador/[memberId]  → regra + flags do membro
 * PUT   /api/comissao/colaborador/[memberId]  → salva regra + flags (owner/admin)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { isFeatureEnabled } from '@/lib/features'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const faixaSchema = z.object({
  ate: z.number().nullable(),
  pct: z.number().min(0).max(100).optional(),
  valor: z.number().min(0).optional(),
})

const schema = z.object({
  isVendedor: z.boolean().optional(),
  comissionado: z.boolean().optional(),
  regra: z
    .object({
      tipo: z.enum(['percentual', 'fixo', 'piso_percentual', 'faixas']),
      pct: z.number().min(0).max(100).default(0),
      valorFixo: z.number().min(0).nullable().optional(),
      baseFixo: z.enum(['periodo', 'negocio']).default('periodo'),
      faixas: z.array(faixaSchema).nullable().optional(),
      ativo: z.boolean().default(true),
    })
    .nullable()
    .optional(),
})

async function guard(memberId: string) {
  const scope = await getScope()
  if (!scope) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  if (!(await isFeatureEnabled(scope.workspaceId, 'comissionamento'))) {
    return { error: NextResponse.json({ error: 'feature_disabled' }, { status: 403 }) }
  }
  const member = await db.workspaceMember.findFirst({
    where: { id: memberId, workspaceId: scope.workspaceId },
    select: { id: true },
  })
  if (!member) return { error: NextResponse.json({ error: 'not_found' }, { status: 404 }) }
  return { scope }
}

export async function GET(_req: NextRequest, { params }: { params: { memberId: string } }) {
  const g = await guard(params.memberId)
  if (g.error) return g.error
  const member = await db.workspaceMember.findUnique({
    where: { id: params.memberId },
    select: {
      id: true, isVendedor: true, comissionado: true,
      regraComissao: true,
    },
  })
  return NextResponse.json({ ok: true, member })
}

export async function PUT(req: NextRequest, { params }: { params: { memberId: string } }) {
  const g = await guard(params.memberId)
  if (g.error) return g.error
  const scope = g.scope!

  if (scope.workspaceRole !== 'owner' && scope.workspaceRole !== 'admin' && !scope.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid' }, { status: 400 })
  }
  const { isVendedor, comissionado, regra } = parsed.data

  await db.$transaction(async (tx) => {
    if (isVendedor !== undefined || comissionado !== undefined) {
      await tx.workspaceMember.update({
        where: { id: params.memberId },
        data: {
          ...(isVendedor !== undefined ? { isVendedor } : {}),
          ...(comissionado !== undefined ? { comissionado } : {}),
        },
      })
    }
    if (regra) {
      await tx.regraComissaoColaborador.upsert({
        where: { memberId: params.memberId },
        create: {
          workspaceId: scope.workspaceId,
          memberId: params.memberId,
          tipo: regra.tipo,
          pct: regra.pct,
          valorFixo: regra.valorFixo ?? null,
          baseFixo: regra.baseFixo,
          faixas: regra.faixas ?? undefined,
          ativo: regra.ativo,
        },
        update: {
          tipo: regra.tipo,
          pct: regra.pct,
          valorFixo: regra.valorFixo ?? null,
          baseFixo: regra.baseFixo,
          faixas: regra.faixas ?? undefined,
          ativo: regra.ativo,
        },
      })
    }
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'comissao_colaborador_atualizada',
    entidade: 'workspace_member',
    entidadeId: params.memberId,
    mudancas: { isVendedor, comissionado, tipoRegra: regra?.tipo ?? null },
  }).catch(() => undefined)

  return NextResponse.json({ ok: true })
}
