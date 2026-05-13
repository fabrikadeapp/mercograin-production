'use server'

/**
 * BH Grain — Server Actions para mutações no drawer da proposta.
 * Auth: requireBhGrainScope (multi-tenant) + permissions.
 */

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { requireBhGrainScope } from '@/lib/bhgrain/scope-permissions'
import { Prisma } from '@prisma/client'
import { validarLogistica } from '@/lib/bhgrain/logistica-validation'

interface LogisticaUpdate {
  origem?: string | null
  destino?: string | null
  localEntrega?: string | null
  modalTransporte?: string | null
  freteTipo?: string | null
  freteCustoTotal?: number | null
  freteCustoUnit?: number | null
  prazoLogistico?: string | null
  incoterm?: string | null
  armazemOrigemRefId?: string | null
  armazemDestinoRefId?: string | null
}

const MODAIS = ['rodoviario', 'ferroviario', 'hidroviario', 'multimodal'] as const
const FRETE_TIPOS = ['incluso', 'comprador', 'vendedor', 'definir'] as const

function pickString(v: FormDataEntryValue | null, max = 120): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s.slice(0, max) : null
}

function pickNumber(v: FormDataEntryValue | null): number | null {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

async function loadPropostaScope(propostaId: string, workspaceId: string) {
  const p = await db.proposta.findFirst({
    where: { id: propostaId, workspaceId },
    select: { id: true, workspaceId: true, status: true },
  })
  return p
}

export async function updatePropostaLogistica(formData: FormData): Promise<void> {
  const scope = await requireBhGrainScope()
  scope.require('edit_proposal')
  const propostaId = pickString(formData.get('propostaId'), 64)
  if (!propostaId) throw new Error('propostaId obrigatório')
  const p = await loadPropostaScope(propostaId, scope.workspaceId)
  if (!p) throw new Error('Proposta não encontrada')

  const modal = pickString(formData.get('modalTransporte'), 20)
  if (modal && !(MODAIS as readonly string[]).includes(modal)) throw new Error('Modal inválido')
  const freteTipo = pickString(formData.get('freteTipo'), 20)
  if (freteTipo && !(FRETE_TIPOS as readonly string[]).includes(freteTipo)) throw new Error('Tipo de frete inválido')

  const armazemOrigemRefId = pickString(formData.get('armazemOrigemRefId'), 64)
  const armazemDestinoRefId = pickString(formData.get('armazemDestinoRefId'), 64)
  // Valida armazéns pertencem ao workspace
  if (armazemOrigemRefId) {
    const a = await db.armazem.findFirst({ where: { id: armazemOrigemRefId, workspaceId: scope.workspaceId }, select: { id: true } })
    if (!a) throw new Error('Armazém origem inválido')
  }
  if (armazemDestinoRefId) {
    const a = await db.armazem.findFirst({ where: { id: armazemDestinoRefId, workspaceId: scope.workspaceId }, select: { id: true } })
    if (!a) throw new Error('Armazém destino inválido')
  }

  const prazoStr = pickString(formData.get('prazoLogistico'), 32)
  const prazoLogistico = prazoStr ? new Date(prazoStr) : null
  if (prazoLogistico && Number.isNaN(prazoLogistico.getTime())) throw new Error('Prazo logístico inválido')

  const upd: LogisticaUpdate = {
    origem: pickString(formData.get('origem'), 120),
    destino: pickString(formData.get('destino'), 120),
    localEntrega: pickString(formData.get('localEntrega'), 120),
    modalTransporte: modal,
    freteTipo,
    freteCustoTotal: pickNumber(formData.get('freteCustoTotal')),
    freteCustoUnit: pickNumber(formData.get('freteCustoUnit')),
    prazoLogistico: prazoLogistico ? prazoLogistico.toISOString() : null,
    incoterm: pickString(formData.get('incoterm'), 10),
    armazemOrigemRefId,
    armazemDestinoRefId,
  }

  // Validações cross-field (função pura testável)
  const val = validarLogistica({
    freteTipo: upd.freteTipo ?? null,
    freteCustoTotal: upd.freteCustoTotal ?? null,
    freteCustoUnit: upd.freteCustoUnit ?? null,
    modalTransporte: upd.modalTransporte ?? null,
    origem: upd.origem ?? null,
    destino: upd.destino ?? null,
  })
  if (!val.ok) {
    throw new Error(val.errors.join(' · '))
  }

  await db.proposta.update({
    where: { id: propostaId },
    data: {
      origem: upd.origem,
      destino: upd.destino,
      localEntrega: upd.localEntrega,
      modalTransporte: upd.modalTransporte,
      freteTipo: upd.freteTipo,
      freteCustoTotal: upd.freteCustoTotal != null ? new Prisma.Decimal(upd.freteCustoTotal) : null,
      freteCustoUnit: upd.freteCustoUnit != null ? new Prisma.Decimal(upd.freteCustoUnit) : null,
      prazoLogistico: prazoLogistico,
      incoterm: upd.incoterm,
      armazemOrigemRefId: upd.armazemOrigemRefId,
      armazemDestinoRefId: upd.armazemDestinoRefId,
    },
  })
  await db.auditLog.create({
    data: {
      userId: scope.userId,
      acao: 'Logística atualizada',
      entidade: 'Proposta',
      entidadeId: propostaId,
      workspaceId: scope.workspaceId,
      mudancas: upd as unknown as Prisma.InputJsonValue,
    },
  })
  revalidatePath('/bhgrain')
}

export async function updatePropostaEstoque(formData: FormData): Promise<void> {
  const scope = await requireBhGrainScope()
  scope.require('edit_proposal')
  const propostaId = pickString(formData.get('propostaId'), 64)
  if (!propostaId) throw new Error('propostaId obrigatório')
  const p = await loadPropostaScope(propostaId, scope.workspaceId)
  if (!p) throw new Error('Proposta não encontrada')

  const loteEstoqueRefId = pickString(formData.get('loteEstoqueRefId'), 64)
  if (loteEstoqueRefId) {
    const lote = await db.loteEstoque.findFirst({
      where: { id: loteEstoqueRefId, workspaceId: scope.workspaceId },
      select: { id: true, qtdAtualSc: true, status: true },
    })
    if (!lote) throw new Error('Lote inválido')
    if (lote.status !== 'ativo') throw new Error('Lote não está ativo')
  }

  await db.proposta.update({
    where: { id: propostaId },
    data: { loteEstoqueRefId },
  })
  await db.auditLog.create({
    data: {
      userId: scope.userId,
      acao: 'Estoque vinculado à proposta',
      entidade: 'Proposta',
      entidadeId: propostaId,
      workspaceId: scope.workspaceId,
      mudancas: { loteEstoqueRefId },
    },
  })
  revalidatePath('/bhgrain')
}

export async function updatePropostaQualidade(formData: FormData): Promise<void> {
  const scope = await requireBhGrainScope()
  scope.require('edit_proposal')
  const propostaId = pickString(formData.get('propostaId'), 64)
  if (!propostaId) throw new Error('propostaId obrigatório')
  const p = await loadPropostaScope(propostaId, scope.workspaceId)
  if (!p) throw new Error('Proposta não encontrada')

  const spec = {
    umidadeMax: pickNumber(formData.get('umidadeMax')),
    impurezaMax: pickNumber(formData.get('impurezaMax')),
    ph: pickNumber(formData.get('ph')),
    proteinaMin: pickNumber(formData.get('proteinaMin')),
    ardidosMax: pickNumber(formData.get('ardidosMax')),
    avariadosMax: pickNumber(formData.get('avariadosMax')),
    padraoComercial: pickString(formData.get('padraoComercial'), 100),
    observacoes: pickString(formData.get('observacoes'), 500),
  }
  // Remove nulls
  const cleaned = Object.fromEntries(Object.entries(spec).filter(([, v]) => v !== null)) as Prisma.InputJsonObject

  await db.proposta.update({
    where: { id: propostaId },
    data: { qualidadeSpec: Object.keys(cleaned).length > 0 ? cleaned : Prisma.JsonNull },
  })
  await db.auditLog.create({
    data: {
      userId: scope.userId,
      acao: 'Qualidade atualizada',
      entidade: 'Proposta',
      entidadeId: propostaId,
      workspaceId: scope.workspaceId,
      mudancas: cleaned as Prisma.InputJsonValue,
    },
  })
  revalidatePath('/bhgrain')
}
