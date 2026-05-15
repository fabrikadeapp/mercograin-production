'use server'

/**
 * Server actions para /configuracoes/fluxo-trabalho.
 * Auth: owner/admin do workspace via requireBhGrainScope.
 */

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { requireBhGrainScope } from '@/lib/bhgrain/scope-permissions'
import {
  upsertMarginRule,
  deleteMarginRule,
  seedDefaultMargins,
} from '@/lib/bhgrain/margin-rules'

async function requireWorkspaceAdmin() {
  const scope = await requireBhGrainScope()
  if (!scope.isAdmin && !['owner', 'admin'].includes(scope.workspaceRole)) {
    throw new Error('Acesso negado: apenas owner/admin do workspace')
  }
  return scope
}

export async function saveMargin(input: {
  commodity: string
  margemPercent: number
  margemMinima?: number | null
  observacoes?: string | null
  ativa?: boolean
}): Promise<void> {
  const scope = await requireWorkspaceAdmin()
  await upsertMarginRule({
    workspaceId: scope.workspaceId,
    commodity: input.commodity,
    margemPercent: input.margemPercent,
    margemMinima: input.margemMinima ?? null,
    observacoes: input.observacoes ?? null,
    ativa: input.ativa ?? true,
    userId: scope.userId,
  })
  await db.auditLog.create({
    data: {
      userId: scope.userId,
      acao: 'Margem comercial atualizada',
      entidade: 'CommodityMarginRule',
      entidadeId: `${scope.workspaceId}:${input.commodity}`,
      workspaceId: scope.workspaceId,
      mudancas: {
        commodity: input.commodity,
        margemPercent: input.margemPercent,
        margemMinima: input.margemMinima,
      },
    },
  })
  revalidatePath('/configuracoes/fluxo-trabalho')
}

export async function removeMargin(commodity: string): Promise<void> {
  const scope = await requireWorkspaceAdmin()
  await deleteMarginRule(scope.workspaceId, commodity)
  await db.auditLog.create({
    data: {
      userId: scope.userId,
      acao: 'Margem comercial removida',
      entidade: 'CommodityMarginRule',
      entidadeId: `${scope.workspaceId}:${commodity}`,
      workspaceId: scope.workspaceId,
      mudancas: { commodity },
    },
  })
  revalidatePath('/configuracoes/fluxo-trabalho')
}

export async function applySeedMargins(): Promise<{ inserted: number }> {
  const scope = await requireWorkspaceAdmin()
  const inserted = await seedDefaultMargins(scope.workspaceId, scope.userId)
  if (inserted > 0) {
    await db.auditLog.create({
      data: {
        userId: scope.userId,
        acao: 'Margens padrão (seed) aplicadas',
        entidade: 'CommodityMarginRule',
        entidadeId: scope.workspaceId,
        workspaceId: scope.workspaceId,
        mudancas: { inserted },
      },
    })
  }
  revalidatePath('/configuracoes/fluxo-trabalho')
  return { inserted }
}
