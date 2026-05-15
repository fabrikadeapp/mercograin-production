/**
 * BH Grain — Margem padrão por workspace × commodity.
 *
 * Quando o cliente cadastra "Soja: 0,3%" em /configuracoes/fluxo-trabalho,
 * cada proposta nova de soja já vem com essa margem preenchida. O score
 * IA e os alertas comerciais usam esse % como referência.
 *
 * Fórmulas de conversão (saca brasileira padrão = 60 kg):
 *   tonelada → sacas:  ton × 16,6667  (1000 / 60)
 *   sacas    → ton:    sc / 16,6667
 *   margem R$ por sc:  precoSc × margemPercent/100
 *   margem R$ por ton: precoTon × margemPercent/100  ≡  margemSc × 16,6667
 *
 * Ex.: Soja R$ 130/sc × 0,3% = R$ 0,39/sc = R$ 6,50/t
 */

import { db } from '@/lib/db'

/** Lista canônica das commodities suportadas. */
export const SUPPORTED_COMMODITIES = [
  'soja',
  'milho',
  'trigo',
  'sorgo',
  'aveia',
  'arroz',
  'algodao',
  'cafe',
] as const

export type Commodity = (typeof SUPPORTED_COMMODITIES)[number]

export interface MarginRule {
  id: string
  commodity: string
  margemPercent: number // 0.3 = 0,3%
  margemMinima: number | null
  observacoes: string | null
  ativa: boolean
  updatedAt: string
}

interface DbRow {
  id: string
  commodity: string
  margemPercent: { toString(): string }
  margemMinima: { toString(): string } | null
  observacoes: string | null
  ativa: boolean
  updatedAt: Date
}

function toView(r: DbRow): MarginRule {
  return {
    id: r.id,
    commodity: r.commodity,
    margemPercent: Number(r.margemPercent),
    margemMinima: r.margemMinima != null ? Number(r.margemMinima) : null,
    observacoes: r.observacoes,
    ativa: r.ativa,
    updatedAt: r.updatedAt.toISOString(),
  }
}

/** Lista todas as regras do workspace (inclui inativas). */
export async function listMarginRules(workspaceId: string): Promise<MarginRule[]> {
  const rows = await db.commodityMarginRule.findMany({
    where: { workspaceId },
    orderBy: [{ ativa: 'desc' }, { commodity: 'asc' }],
  })
  return rows.map(toView)
}

/** Retorna a margem ativa para uma commodity (ou null se não cadastrada). */
export async function getMarginForCommodity(
  workspaceId: string,
  commodity: string
): Promise<MarginRule | null> {
  const row = await db.commodityMarginRule.findUnique({
    where: { workspaceId_commodity: { workspaceId, commodity: commodity.toLowerCase() } },
  })
  return row && row.ativa ? toView(row) : null
}

/** Map { soja: 0.3, milho: 0.4, ... } para uso em formulários. */
export async function getMarginMap(workspaceId: string): Promise<Record<string, number>> {
  const rules = await listMarginRules(workspaceId)
  const map: Record<string, number> = {}
  for (const r of rules) {
    if (r.ativa) map[r.commodity] = r.margemPercent
  }
  return map
}

export interface UpsertMarginInput {
  workspaceId: string
  commodity: string
  margemPercent: number
  margemMinima?: number | null
  observacoes?: string | null
  ativa?: boolean
  userId?: string
}

export async function upsertMarginRule(input: UpsertMarginInput): Promise<MarginRule> {
  const commodity = input.commodity.toLowerCase().trim()
  if (!commodity) throw new Error('Commodity obrigatória')
  if (!Number.isFinite(input.margemPercent) || input.margemPercent < 0 || input.margemPercent > 100) {
    throw new Error('Margem deve estar entre 0 e 100%')
  }
  if (
    input.margemMinima != null &&
    (input.margemMinima < 0 || input.margemMinima > input.margemPercent)
  ) {
    throw new Error('Margem mínima não pode ser maior que a margem alvo')
  }

  const row = await db.commodityMarginRule.upsert({
    where: { workspaceId_commodity: { workspaceId: input.workspaceId, commodity } },
    create: {
      workspaceId: input.workspaceId,
      commodity,
      margemPercent: input.margemPercent,
      margemMinima: input.margemMinima ?? null,
      observacoes: input.observacoes ?? null,
      ativa: input.ativa ?? true,
      createdBy: input.userId,
    },
    update: {
      margemPercent: input.margemPercent,
      margemMinima: input.margemMinima ?? null,
      observacoes: input.observacoes ?? null,
      ativa: input.ativa ?? undefined,
    },
  })
  return toView(row)
}

export async function deleteMarginRule(workspaceId: string, commodity: string): Promise<void> {
  await db.commodityMarginRule.deleteMany({
    where: { workspaceId, commodity: commodity.toLowerCase() },
  })
}

/**
 * Calcula o resultado financeiro de uma margem aplicada a um preço.
 * Aceita preço em R$/sc ou R$/t (precisa indicar a unidade).
 */
export function calcularMargem(args: {
  margemPercent: number
  precoBrl: number
  unidade: 'sc60' | 'ton'
}): {
  /** R$ ganhos por unidade (mesma do preço de entrada). */
  margemPorUnidade: number
  /** R$ por saca de 60kg (sempre, mesmo se input foi /t). */
  margemPorSc: number
  /** R$ por tonelada (sempre, mesmo se input foi /sc). */
  margemPorTon: number
} {
  const fator = args.margemPercent / 100
  const margemPorUnidade = args.precoBrl * fator
  const SC_POR_TON = 1000 / 60 // 16,6667 sacas por tonelada (saca padrão 60kg)
  if (args.unidade === 'sc60') {
    return {
      margemPorUnidade,
      margemPorSc: margemPorUnidade,
      margemPorTon: margemPorUnidade * SC_POR_TON,
    }
  }
  return {
    margemPorUnidade,
    margemPorSc: margemPorUnidade / SC_POR_TON,
    margemPorTon: margemPorUnidade,
  }
}

/**
 * Seed de margens padrão da indústria — sugestão inicial para clientes novos.
 * Cliente pode editar tudo depois.
 */
export const DEFAULT_MARGINS_SEED: Array<{ commodity: Commodity; margemPercent: number }> = [
  { commodity: 'soja', margemPercent: 0.3 },
  { commodity: 'milho', margemPercent: 0.4 },
  { commodity: 'trigo', margemPercent: 0.5 },
]

export async function seedDefaultMargins(workspaceId: string, userId?: string): Promise<number> {
  const existing = await db.commodityMarginRule.count({ where: { workspaceId } })
  if (existing > 0) return 0
  let count = 0
  for (const seed of DEFAULT_MARGINS_SEED) {
    await upsertMarginRule({
      workspaceId,
      commodity: seed.commodity,
      margemPercent: seed.margemPercent,
      userId,
    })
    count++
  }
  return count
}
