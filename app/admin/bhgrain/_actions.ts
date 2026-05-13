'use server'

/**
 * BH Grain Admin — Server Actions para CRUD de Metas, Regras e Perdas.
 * Auth: herda guard do /admin/layout.tsx (User.role === 'admin').
 */

import { db } from '@/lib/db'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { REGRA_TIPOS, REGRA_ACOES, LOSS_REASONS_ARR } from './_constants'

async function requireAdmin(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Não autorizado')
  const u = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (u?.role !== 'admin') throw new Error('Acesso negado')
  return session.user.id
}

// ============================================================================
// MetaComercial
// ============================================================================

export async function createMeta(formData: FormData) {
  const userId = await requireAdmin()
  const workspaceId = String(formData.get('workspaceId') ?? '')
  const periodo = String(formData.get('periodo') ?? '')
  const valorMeta = Number(formData.get('valorMeta') ?? 0)
  const moeda = (String(formData.get('moeda') ?? 'BRL').toUpperCase()).slice(0, 3)
  const commodity = String(formData.get('commodity') ?? '').trim() || null
  const userScope = String(formData.get('userId') ?? '').trim() || null

  if (!workspaceId || !/^\d{4}-\d{2}$/.test(periodo) || !Number.isFinite(valorMeta) || valorMeta <= 0) {
    throw new Error('Dados inválidos: workspace, período (YYYY-MM) e valor > 0 obrigatórios')
  }

  await db.metaComercial.upsert({
    where: {
      workspaceId_periodo_userId_commodity: {
        workspaceId,
        periodo,
        userId: userScope as string,
        commodity: commodity as string,
      },
    },
    create: { workspaceId, periodo, userId: userScope, commodity, valorMeta, moeda },
    update: { valorMeta, moeda },
  })

  await db.auditLog.create({
    data: {
      userId,
      acao: 'Meta comercial criada/atualizada',
      entidade: 'MetaComercial',
      entidadeId: `${workspaceId}:${periodo}`,
      workspaceId,
      mudancas: { valorMeta, moeda, commodity, userScope },
    },
  })

  revalidatePath('/admin/bhgrain/metas')
}

export async function deleteMeta(formData: FormData) {
  const userId = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  if (!id) throw new Error('id obrigatório')

  const meta = await db.metaComercial.findUnique({ where: { id }, select: { workspaceId: true, periodo: true } })
  if (!meta) return

  await db.metaComercial.delete({ where: { id } })
  await db.auditLog.create({
    data: {
      userId,
      acao: 'Meta comercial removida',
      entidade: 'MetaComercial',
      entidadeId: id,
      workspaceId: meta.workspaceId,
      mudancas: { periodo: meta.periodo },
    },
  })
  revalidatePath('/admin/bhgrain/metas')
}

// ============================================================================
// CommercialRule
// ============================================================================

export async function createRegra(formData: FormData) {
  const userId = await requireAdmin()
  const workspaceId = String(formData.get('workspaceId') ?? '')
  const name = String(formData.get('name') ?? '').trim().slice(0, 120)
  const type = String(formData.get('type') ?? '') as (typeof REGRA_TIPOS)[number]
  const action = String(formData.get('action') ?? '') as (typeof REGRA_ACOES)[number]
  const commodity = String(formData.get('commodity') ?? '').trim() || null
  const thresholdRaw = String(formData.get('threshold') ?? '').trim()
  const threshold = thresholdRaw ? Number(thresholdRaw.replace(',', '.')) : null
  const active = formData.get('active') !== null

  if (!workspaceId || !name || !REGRA_TIPOS.includes(type) || !REGRA_ACOES.includes(action)) {
    throw new Error('Dados inválidos')
  }
  if (threshold != null && !Number.isFinite(threshold)) {
    throw new Error('threshold inválido')
  }

  await db.commercialRule.create({
    data: { workspaceId, name, type, action, commodity, threshold, active, createdBy: userId },
  })
  await db.auditLog.create({
    data: { userId, acao: 'Regra comercial criada', entidade: 'CommercialRule', entidadeId: name, workspaceId, mudancas: { type, action, commodity, threshold } },
  })
  revalidatePath('/admin/bhgrain/regras')
}

export async function toggleRegra(formData: FormData) {
  const userId = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  if (!id) throw new Error('id obrigatório')
  const r = await db.commercialRule.findUnique({ where: { id } })
  if (!r) return
  await db.commercialRule.update({ where: { id }, data: { active: !r.active } })
  await db.auditLog.create({
    data: { userId, acao: r.active ? 'Regra desativada' : 'Regra ativada', entidade: 'CommercialRule', entidadeId: id, workspaceId: r.workspaceId },
  })
  revalidatePath('/admin/bhgrain/regras')
}

export async function deleteRegra(formData: FormData) {
  const userId = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  if (!id) throw new Error('id obrigatório')
  const r = await db.commercialRule.findUnique({ where: { id }, select: { workspaceId: true, name: true } })
  if (!r) return
  await db.commercialRule.delete({ where: { id } })
  await db.auditLog.create({
    data: { userId, acao: 'Regra removida', entidade: 'CommercialRule', entidadeId: id, workspaceId: r.workspaceId, mudancas: { name: r.name } },
  })
  revalidatePath('/admin/bhgrain/regras')
}

// ============================================================================
// Proposta — marcar motivo de perda
// ============================================================================

export async function setLossReason(formData: FormData) {
  const userId = await requireAdmin()
  const propostaId = String(formData.get('propostaId') ?? '')
  const reason = String(formData.get('reason') ?? '') as (typeof LOSS_REASONS_ARR)[number]
  if (!propostaId || !LOSS_REASONS_ARR.includes(reason)) throw new Error('Dados inválidos')

  const p = await db.proposta.findUnique({ where: { id: propostaId }, select: { workspaceId: true } })
  if (!p) return

  await db.proposta.update({ where: { id: propostaId }, data: { lossReason: reason, status: 'recusada' } })
  await db.auditLog.create({
    data: { userId, acao: 'Motivo de perda registrado', entidade: 'Proposta', entidadeId: propostaId, workspaceId: p.workspaceId, mudancas: { reason } },
  })
  revalidatePath('/admin/bhgrain/perdas')
}

