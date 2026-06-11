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
  // fiscal NÃO é mais core — virou exclusivo do plano enterprise (ver PLAN_FEATURES).
  fiscal: {
    label: 'Fiscal',
    description: 'Notas fiscais, SPED, compliance tributário',
    core: false,
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
    default: true,
  },
  hedge: {
    label: 'Hedge & Futuros',
    description: 'Posições CBOT, marcação a mercado, risco',
    core: false,
    default: true,
  },
  portal_produtor: {
    label: 'Portal do Produtor',
    description: 'B2C lite — produtor acessa contratos próprios',
    core: false,
    default: true,
  },
  logistica: {
    label: 'Logística',
    description: 'Romaneios, ordens de carga, armazéns',
    core: false,
    default: true,
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
    default: true,
  },
  classificados: {
    label: 'Classificados',
    description: 'Anúncios entre membros',
    core: false,
    default: false,
  },
  comissionamento: {
    label: 'Comissionamento de Colaborador',
    description:
      'Comissão por vendedor interno: % fixo, valor fixo, piso+%, faixas progressivas. Apuração por período.',
    core: false,
    default: true,
  },
  match: {
    label: 'Motor de Match',
    description: 'Cruza ofertas (venda) × demandas (compra) por produto, volume, preço, região e qualidade.',
    core: false,
    default: true,
  },
  dossie: {
    label: 'Dossiê do Negócio',
    description: 'Histórico consolidado por negócio: timeline, documentos, contrato, NF, romaneio, comissão.',
    core: false,
    default: true,
  },
  demandas: {
    label: 'Demandas de Compra',
    description: 'Pedidos de compra estruturados (quem quer comprar), tratados pela IA por canal.',
    core: false,
    default: true,
  },
  simulador_cbot: {
    label: 'Simulador CBOT',
    description:
      'Formação de preço de exportação: CBOT + prêmio + FOBBINGS + câmbio + frete → R$/saca por trading e por praça.',
    core: false,
    default: true,
  },
  simulador_premios: {
    label: 'Simulador de Prêmios',
    description:
      'Engenharia reversa do prêmio: preço de balcão das tradings → prêmio implícito (basis), por mês de vencimento.',
    core: false,
    default: true,
  },
  calculadora_mesa: {
    label: 'Calculadora de Mesa',
    description:
      'Visão integrada: preço formado, prêmio implícito e spread por trading.',
    core: false,
    default: true,
  },
  relatorios_usda: {
    label: 'Relatórios USDA',
    description:
      'Projeções USDA (WASDE/PSD) de oferta e demanda — estoques, produção e produtividade de soja e milho, com link público compartilhável.',
    core: false,
    default: true,
  },
} as const

export type FeatureKey = keyof typeof FEATURES

/**
 * MAPA PLANO → FEATURES (modelo ESTRITO).
 *
 * O plano é a ÚNICA fonte de verdade do que está liberado. Uma feature
 * (não-core) só está ON se o plano da subscription do workspace a concede.
 * WorkspaceFeature manual NÃO concede acima do plano — ele só pode refinar
 * pra MENOS (admin desligar algo que o plano dá).
 *
 * Só listamos features NÃO-core aqui. Os módulos core (mesa, financeiro,
 * gestao) estão sempre on via isCore() — não precisam constar na matriz.
 *
 * Features do catálogo que NÃO aparecem em nenhum plano (originacao,
 * marketplace, classificados) ficam OFF para todos sob o modelo estrito,
 * até que sejam atribuídas a algum plano.
 *
 * ⚠️ COERÊNCIA COM lib/ai/client.ts (Plan.aiAccess):
 *   - laura_ai só está em pro/enterprise → esses planos DEVEM ter
 *     Plan.aiAccess != 'none' ('managed' ou 'byok_allowed').
 *   - starter NÃO tem laura_ai → Plan.aiAccess do starter DEVE ser 'none'.
 *   A aplicação dos valores de aiAccess nos planos é feita por outro processo;
 *   aqui apenas garantimos que a matriz não se contradiga com aquela regra.
 */
export const PLAN_FEATURES: Record<string, FeatureKey[]> = {
  starter: [
    // core (mesa/financeiro/gestao) já vem on via isCore — não listar aqui.
    'portal_produtor',
    'demandas',
  ],
  pro: [
    'portal_produtor',
    'demandas',
    'laura_ai',
    'hedge',
    'match',
    'comissionamento',
    'logistica',
    'simulador_cbot',
    'simulador_premios',
    'calculadora_mesa',
    'relatorios_usda',
  ],
  enterprise: [
    'portal_produtor',
    'demandas',
    'laura_ai',
    'hedge',
    'match',
    'comissionamento',
    'logistica',
    'fiscal',
    'eudr',
    'dossie',
    'simulador_cbot',
    'simulador_premios',
    'calculadora_mesa',
    'relatorios_usda',
  ],
}

/**
 * Plano usado como fallback quando o workspace não tem subscription
 * (trial pré-checkout, dados inconsistentes, etc.). Escolhemos `starter`
 * (acesso mínimo viável) em vez de bloqueio geral, para não deixar ninguém
 * numa tela quebrada — o core continua acessível e as features básicas
 * (portal_produtor, demandas) também.
 */
export const FALLBACK_PLAN = 'starter' as const

/**
 * Retorna as FeatureKeys concedidas por um slug de plano.
 * Plano desconhecido/ausente cai no FALLBACK_PLAN.
 */
export function featuresForPlan(planSlug: string | null | undefined): FeatureKey[] {
  if (planSlug && PLAN_FEATURES[planSlug]) return PLAN_FEATURES[planSlug]
  return PLAN_FEATURES[FALLBACK_PLAN]
}

/** O plano concede esta feature (não considera kill-switch nem core). */
export function planGrants(planSlug: string | null | undefined, key: FeatureKey): boolean {
  return featuresForPlan(planSlug).includes(key)
}

export function isCore(key: FeatureKey): boolean {
  return FEATURES[key]?.core ?? false
}

/** Busca o slug do plano da subscription do workspace (null se não houver). */
async function getWorkspacePlan(workspaceId: string): Promise<string | null> {
  const sub = await db.subscription.findUnique({
    where: { workspaceId },
    select: { plan: true },
  })
  return sub?.plan ?? null
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
 *
 * MODELO ESTRITO POR PLANO — o plano é a única fonte de verdade.
 *
 * Resolução:
 *   1. Core (isCore) → sempre ON.
 *   2. Kill-switch global (SystemFeatureFlag) off → OFF sempre.
 *   3. Plano concede a feature? (PLAN_FEATURES[plano].includes(key))
 *      - NÃO concede → OFF (WorkspaceFeature manual NÃO liga acima do plano).
 *      - Concede → ON, A MENOS que exista WorkspaceFeature explicitamente OFF
 *        (admin pode refinar pra menos). Sem registro WorkspaceFeature, vale
 *        o plano.
 *
 * Sem subscription → usa FALLBACK_PLAN (starter), nunca 403 geral.
 */
export async function isFeatureEnabled(
  workspaceId: string,
  key: FeatureKey,
): Promise<boolean> {
  if (isCore(key)) return true

  const globalOn = await getSystemFlag(key)
  if (!globalOn) return false

  const plan = await getWorkspacePlan(workspaceId)
  if (!planGrants(plan, key)) return false

  // Plano concede: ON, salvo override manual pra MENOS.
  const row = await db.workspaceFeature.findUnique({
    where: { workspaceId_feature: { workspaceId, feature: key } },
    select: { enabled: true },
  })
  // Sem registro → vale o plano (ON). Com registro → respeita o off manual.
  return row?.enabled ?? true
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
  const [wsRows, sysRows, sub] = await Promise.all([
    db.workspaceFeature.findMany({
      where: { workspaceId },
      select: { feature: true, enabled: true },
    }),
    db.systemFeatureFlag.findMany({
      select: { feature: true, enabled: true },
    }),
    db.subscription.findUnique({
      where: { workspaceId },
      select: { plan: true },
    }),
  ])
  const wsMap = new Map(wsRows.map((r) => [r.feature, r.enabled]))
  const sysMap = new Map(sysRows.map((r) => [r.feature, r.enabled]))
  const plan = sub?.plan ?? null
  const out = {} as Record<FeatureKey, boolean>
  for (const k of Object.keys(FEATURES) as FeatureKey[]) {
    if (isCore(k)) {
      out[k] = true
      continue
    }
    // Kill-switch global.
    const sysOn = sysMap.has(k) ? sysMap.get(k)! : FEATURES[k].default
    if (!sysOn) {
      out[k] = false
      continue
    }
    // Modelo estrito: plano precisa conceder.
    if (!planGrants(plan, k)) {
      out[k] = false
      continue
    }
    // Plano concede → ON, salvo override manual pra menos.
    out[k] = wsMap.get(k) ?? true
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
