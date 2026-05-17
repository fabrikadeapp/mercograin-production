/**
 * Feature flags por workspace.
 *
 * Cada módulo do produto pode ser ativado/desativado por workspace.
 * Super-admin controla via /admin/workspaces/[id]/features.
 *
 * Default: módulos CORE estão sempre ativos. Demais começam desativados.
 */

import { db } from '@/lib/db'

/** Catálogo canônico de features. Adicionar novas aqui. */
export const FEATURES = {
  // CORE (sempre ativos, não toggláveis via UI)
  mesa: {
    label: 'Mesa Comercial',
    description: 'Propostas, contratos, clientes — core do produto',
    core: true,
    default: true,
  },
  financeiro: {
    label: 'Financeiro',
    description: 'Movimentos, comissões, DRE',
    core: true,
    default: true,
  },
  fiscal: {
    label: 'Fiscal',
    description: 'Notas fiscais, SPED, compliance tributário',
    core: true,
    default: true,
  },
  gestao: {
    label: 'Gestão',
    description: 'Equipe, configurações, BI executivo',
    core: true,
    default: true,
  },

  // OPCIONAIS (vendidos como add-on)
  originacao: {
    label: 'Originação',
    description: 'Adiantamentos, barter, fixações com produtor',
    core: false,
    default: false,
  },
  eudr: {
    label: 'EUDR (compliance UE)',
    description: 'Rastreabilidade de origem, DDS, áreas protegidas',
    core: false,
    default: false,
  },
  hedge: {
    label: 'Hedge & Futuros',
    description: 'Posições CBOT, marcação a mercado, risco',
    core: false,
    default: false,
  },
  portal_produtor: {
    label: 'Portal do Produtor',
    description: 'B2C lite — produtor acessa contratos próprios',
    core: false,
    default: false,
  },
  logistica: {
    label: 'Logística',
    description: 'Romaneios, ordens de carga, armazéns',
    core: false,
    default: false,
  },
  marketplace: {
    label: 'Marketplace de Ofertas',
    description: 'Publicar ofertas cross-workspace',
    core: false,
    default: false,
  },
  laura_ai: {
    label: 'Laura.IA',
    description: 'Agente conversacional WhatsApp/Telefone',
    core: false,
    default: false,
  },
  classificados: {
    label: 'Classificados',
    description: 'Anúncios entre membros',
    core: false,
    default: false,
  },
} as const

export type FeatureKey = keyof typeof FEATURES

export function isCore(key: FeatureKey): boolean {
  return FEATURES[key]?.core ?? false
}

export function listOptional(): FeatureKey[] {
  return (Object.keys(FEATURES) as FeatureKey[]).filter((k) => !FEATURES[k].core)
}

/**
 * Verifica se uma feature está habilitada para o workspace.
 * Core features sempre retornam true.
 */
export async function isFeatureEnabled(
  workspaceId: string,
  key: FeatureKey,
): Promise<boolean> {
  if (isCore(key)) return true
  const row = await db.workspaceFeature.findUnique({
    where: { workspaceId_feature: { workspaceId, feature: key } },
    select: { enabled: true },
  })
  return row?.enabled ?? FEATURES[key]?.default ?? false
}

/**
 * Carrega TODAS as flags do workspace (com defaults pra features ainda não setadas).
 * Útil pra render no SSR / passar pra client via session.
 */
export async function loadFeaturesFor(
  workspaceId: string,
): Promise<Record<FeatureKey, boolean>> {
  const rows = await db.workspaceFeature.findMany({
    where: { workspaceId },
    select: { feature: true, enabled: true },
  })
  const map = new Map(rows.map((r) => [r.feature, r.enabled]))
  const out = {} as Record<FeatureKey, boolean>
  for (const k of Object.keys(FEATURES) as FeatureKey[]) {
    if (isCore(k)) out[k] = true
    else out[k] = map.get(k) ?? FEATURES[k].default
  }
  return out
}

/** Toggle de feature (apenas super-admin chama). */
export async function setFeature(opts: {
  workspaceId: string
  feature: FeatureKey
  enabled: boolean
  byUserId: string
  notes?: string
}): Promise<void> {
  await db.workspaceFeature.upsert({
    where: {
      workspaceId_feature: {
        workspaceId: opts.workspaceId,
        feature: opts.feature,
      },
    },
    create: {
      workspaceId: opts.workspaceId,
      feature: opts.feature,
      enabled: opts.enabled,
      enabledAt: opts.enabled ? new Date() : null,
      enabledBy: opts.byUserId,
      notes: opts.notes,
    },
    update: {
      enabled: opts.enabled,
      enabledAt: opts.enabled ? new Date() : null,
      enabledBy: opts.byUserId,
      notes: opts.notes,
    },
  })
}
