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
 * Kill-switch global: super-admin pode desligar a feature para TODOS.
 * Cria a linha se não existir (default=false para opcionais).
 */
export async function getSystemFlag(key: FeatureKey): Promise<boolean> {
  if (isCore(key)) return true
  const row = await db.systemFeatureFlag.findUnique({
    where: { feature: key },
    select: { enabled: true },
  })
  if (row) return row.enabled
  // Idempotência: cria com default da catálogo
  const def = FEATURES[key]?.default ?? false
  await db.systemFeatureFlag
    .create({ data: { feature: key, enabled: def } })
    .catch(() => undefined) // race ok
  return def
}

/**
 * Verifica se uma feature está habilitada para o workspace.
 * Core features sempre retornam true.
 *
 * Resolução em cascata:
 *   1. SystemFeatureFlag (super-admin global) → se false, retorna false sempre
 *   2. WorkspaceFeature (por workspace) → se setado, usa
 *   3. FEATURES[key].default → fallback do catálogo
 */
export async function isFeatureEnabled(
  workspaceId: string,
  key: FeatureKey,
): Promise<boolean> {
  if (isCore(key)) return true
  const globalOn = await getSystemFlag(key)
  if (!globalOn) return false
  const row = await db.workspaceFeature.findUnique({
    where: { workspaceId_feature: { workspaceId, feature: key } },
    select: { enabled: true },
  })
  return row?.enabled ?? FEATURES[key]?.default ?? false
}

/**
 * Carrega TODAS as flags do workspace (com defaults pra features ainda não setadas).
 * Útil pra render no SSR / passar pra client via session.
 *
 * Respeita kill-switch global: feature off no SystemFeatureFlag => off aqui.
 */
export async function loadFeaturesFor(
  workspaceId: string,
): Promise<Record<FeatureKey, boolean>> {
  const [wsRows, sysRows] = await Promise.all([
    db.workspaceFeature.findMany({
      where: { workspaceId },
      select: { feature: true, enabled: true },
    }),
    db.systemFeatureFlag.findMany({
      select: { feature: true, enabled: true },
    }),
  ])
  const wsMap = new Map(wsRows.map((r) => [r.feature, r.enabled]))
  const sysMap = new Map(sysRows.map((r) => [r.feature, r.enabled]))
  const out = {} as Record<FeatureKey, boolean>
  for (const k of Object.keys(FEATURES) as FeatureKey[]) {
    if (isCore(k)) {
      out[k] = true
      continue
    }
    const sysOn = sysMap.has(k) ? sysMap.get(k)! : FEATURES[k].default
    if (!sysOn) {
      out[k] = false
      continue
    }
    out[k] = wsMap.get(k) ?? FEATURES[k].default
  }
  return out
}

/**
 * Estado global de todas as features (super-admin view).
 * Não filtra por workspace.
 */
export async function loadSystemFlags(): Promise<
  Record<FeatureKey, { enabled: boolean; toggledAt: Date | null; toggledBy: string | null }>
> {
  const rows = await db.systemFeatureFlag.findMany()
  const map = new Map(rows.map((r) => [r.feature, r]))
  const out = {} as Record<FeatureKey, { enabled: boolean; toggledAt: Date | null; toggledBy: string | null }>
  for (const k of Object.keys(FEATURES) as FeatureKey[]) {
    const r = map.get(k)
    if (isCore(k)) {
      out[k] = { enabled: true, toggledAt: null, toggledBy: null }
    } else {
      out[k] = {
        enabled: r?.enabled ?? FEATURES[k].default,
        toggledAt: r?.toggledAt ?? null,
        toggledBy: r?.toggledBy ?? null,
      }
    }
  }
  return out
}

/** Toggle GLOBAL (super-admin). Liga/desliga a feature para toda a base. */
export async function setSystemFlag(opts: {
  feature: FeatureKey
  enabled: boolean
  byUserId: string
  notes?: string
}): Promise<void> {
  if (isCore(opts.feature)) {
    throw new Error(`Feature ${opts.feature} é core e não pode ser togglada.`)
  }
  await db.systemFeatureFlag.upsert({
    where: { feature: opts.feature },
    create: {
      feature: opts.feature,
      enabled: opts.enabled,
      toggledAt: new Date(),
      toggledBy: opts.byUserId,
      notes: opts.notes,
    },
    update: {
      enabled: opts.enabled,
      toggledAt: new Date(),
      toggledBy: opts.byUserId,
      notes: opts.notes,
    },
  })
}

/** Toggle de feature por workspace (apenas super-admin chama). */
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
