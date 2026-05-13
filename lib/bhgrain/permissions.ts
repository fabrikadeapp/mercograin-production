/**
 * BH Grain — Sistema de permissões por perfil comercial.
 *
 * Função pura: dado (workspaceRole, commercialRole), retorna se uma ação é permitida.
 * Não toca em DB. É chamada por server actions e middlewares de rota.
 *
 * Mapeamento prompt master (§22):
 *   Administrador      → workspaceRole='owner'|'admin' OU User.role='admin'
 *   Gestor comercial   → commercialRole='gestor'
 *   Trader             → commercialRole='trader'
 *   Vendedor           → commercialRole='vendedor'
 *   Financeiro         → commercialRole='financeiro'
 *   Operador           → commercialRole='operador'
 *   Leitura/Consulta   → commercialRole='leitura' OU role='viewer'
 */

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'

export type CommercialRole =
  | 'gestor'
  | 'trader'
  | 'vendedor'
  | 'financeiro'
  | 'operador'
  | 'leitura'

export const COMMERCIAL_ROLES: ReadonlyArray<CommercialRole> = [
  'gestor',
  'trader',
  'vendedor',
  'financeiro',
  'operador',
  'leitura',
]

export const COMMERCIAL_ROLE_LABELS: Record<CommercialRole, string> = {
  gestor: 'Gestor comercial',
  trader: 'Trader',
  vendedor: 'Vendedor',
  financeiro: 'Financeiro',
  operador: 'Operador',
  leitura: 'Leitura/Consulta',
}

export type Permission =
  | 'view_dashboard'
  | 'manage_clients'
  | 'view_inbox'
  | 'process_inbox'
  | 'create_proposal'
  | 'edit_proposal'
  | 'approve_proposal'
  | 'send_proposal'
  | 'manage_margin'
  | 'manage_commercial_rules'
  | 'manage_goal'
  | 'view_financials'
  | 'export_reports'
  | 'manage_integrations'
  | 'view_audit'
  | 'import_data'

export interface PermissionContext {
  workspaceRole: WorkspaceRole | string
  commercialRole?: CommercialRole | string | null
  /** User.role global — 'admin' bypassa todas as restrições. */
  isGlobalAdmin?: boolean
}

const ALL_PERMISSIONS: ReadonlyArray<Permission> = [
  'view_dashboard',
  'manage_clients',
  'view_inbox',
  'process_inbox',
  'create_proposal',
  'edit_proposal',
  'approve_proposal',
  'send_proposal',
  'manage_margin',
  'manage_commercial_rules',
  'manage_goal',
  'view_financials',
  'export_reports',
  'manage_integrations',
  'view_audit',
  'import_data',
]

const READ_ONLY: ReadonlyArray<Permission> = ['view_dashboard', 'view_inbox', 'view_financials']

/**
 * Matriz de permissões por commercialRole. Quando commercialRole é null,
 * cai no fallback de workspaceRole.
 */
const MATRIX: Record<CommercialRole, ReadonlySet<Permission>> = {
  gestor: new Set<Permission>([
    'view_dashboard',
    'manage_clients',
    'view_inbox',
    'process_inbox',
    'create_proposal',
    'edit_proposal',
    'approve_proposal',
    'send_proposal',
    'manage_margin',
    'manage_commercial_rules',
    'manage_goal',
    'view_financials',
    'export_reports',
    'view_audit',
    'import_data',
  ]),
  trader: new Set<Permission>([
    'view_dashboard',
    'manage_clients',
    'view_inbox',
    'process_inbox',
    'create_proposal',
    'edit_proposal',
    'send_proposal',
    'view_financials',
    'export_reports',
  ]),
  vendedor: new Set<Permission>([
    'view_dashboard',
    'manage_clients',
    'view_inbox',
    'process_inbox',
    'create_proposal',
    'edit_proposal',
    'send_proposal',
    'view_financials',
  ]),
  financeiro: new Set<Permission>([
    'view_dashboard',
    'view_inbox',
    'view_financials',
    'manage_goal',
    'export_reports',
    'view_audit',
  ]),
  operador: new Set<Permission>([
    'view_dashboard',
    'view_inbox',
    'process_inbox',
  ]),
  leitura: new Set<Permission>(READ_ONLY),
}

/** Workspace roles → permissões base quando não há commercialRole específico. */
const FALLBACK_BY_WORKSPACE_ROLE: Record<string, ReadonlySet<Permission>> = {
  owner: new Set<Permission>(ALL_PERMISSIONS),
  admin: new Set<Permission>(ALL_PERMISSIONS),
  member: new Set<Permission>([
    'view_dashboard',
    'manage_clients',
    'view_inbox',
    'process_inbox',
    'create_proposal',
    'edit_proposal',
    'send_proposal',
    'view_financials',
    'export_reports',
  ]),
  viewer: new Set<Permission>(READ_ONLY),
}

export function isCommercialRole(v: string | null | undefined): v is CommercialRole {
  return v != null && (COMMERCIAL_ROLES as ReadonlyArray<string>).includes(v)
}

export function can(ctx: PermissionContext, perm: Permission): boolean {
  if (ctx.isGlobalAdmin) return true

  // commercialRole tem precedência se definido
  if (isCommercialRole(ctx.commercialRole as string)) {
    return MATRIX[ctx.commercialRole as CommercialRole].has(perm)
  }

  const fallback = FALLBACK_BY_WORKSPACE_ROLE[ctx.workspaceRole]
  if (!fallback) return false
  return fallback.has(perm)
}

export function requirePermission(ctx: PermissionContext, perm: Permission): void {
  if (!can(ctx, perm)) {
    throw new Error(`Acesso negado: permissão '${perm}' requerida`)
  }
}

/** Lista todas as permissões efetivas — útil para UI. */
export function effectivePermissions(ctx: PermissionContext): Permission[] {
  return ALL_PERMISSIONS.filter((p) => can(ctx, p))
}
