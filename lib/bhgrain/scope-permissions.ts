/**
 * BH Grain — wrapper sobre lib/auth/scope que enriquece com commercialRole +
 * helpers de permissão.
 */

import { db } from '@/lib/db'
import { requireScope, type ScopeCtx } from '@/lib/auth/scope'
import { can, requirePermission, effectivePermissions, type Permission, type CommercialRole, isCommercialRole } from './permissions'

export interface BhGrainScope extends ScopeCtx {
  commercialRole: CommercialRole | null
  permissions: ReadonlyArray<Permission>
  can(perm: Permission): boolean
  require(perm: Permission): void
}

export async function requireBhGrainScope(searchParams?: URLSearchParams): Promise<BhGrainScope> {
  const base = await requireScope(searchParams)

  // commercialRole vem do WorkspaceMember vinculado ao user no workspace ativo
  const member = await db.workspaceMember
    .findFirst({
      where: { workspaceId: base.workspaceId, userId: base.userId },
      select: { commercialRole: true },
    })
    .catch(() => null)

  const commercialRole = isCommercialRole(member?.commercialRole) ? member!.commercialRole : null

  const ctx = {
    workspaceRole: base.workspaceRole,
    commercialRole,
    isGlobalAdmin: base.isAdmin,
  }

  return {
    ...base,
    commercialRole,
    permissions: effectivePermissions(ctx),
    can: (perm: Permission) => can(ctx, perm),
    require: (perm: Permission) => requirePermission(ctx, perm),
  }
}
