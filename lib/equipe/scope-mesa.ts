/**
 * scopeMesa — filtros de visibilidade comercial.
 *
 * Define o que cada colaborador consegue ver dentro da Mesa:
 *
 *  - admin global / owner / admin do workspace → tudo
 *  - cargos gerenciais (gerente_mesa, cfo)     → tudo do workspace
 *  - trader / gerente_conta / cs / outros      → só onde é gerente_conta
 *                                                 ou vendedor (em Cliente,
 *                                                 Proposta, Contrato)
 *
 * Os helpers retornam um fragmento `where` Prisma para spread.
 */

import { db } from '@/lib/db'
import type { ScopeCtx } from '@/lib/auth/scope'
import { temVisaoCompletaMesa } from './funcoes'

export interface MesaScope {
  /** Membership do usuário no workspace ativo (pode ser null se owner sem membership). */
  memberId: string | null
  /** Funções deste membro. */
  funcoes: string[]
  /** True = vê tudo da Mesa do workspace. */
  fullAccess: boolean
}

/**
 * Resolve o escopo de Mesa para o ScopeCtx atual. Faz 1 query no
 * WorkspaceMember para descobrir memberId + funcoes.
 */
export async function resolveMesaScope(scope: ScopeCtx): Promise<MesaScope> {
  // Owner/admin do workspace + admin global → acesso total. Mas mesmo assim
  // precisamos do memberId para inserir como vendedor em novas propostas.
  const member = await db.workspaceMember.findFirst({
    where: { workspaceId: scope.workspaceId, userId: scope.userId },
    select: { id: true, funcoes: true, role: true },
  })

  const fullAccess =
    scope.isAdmin ||
    scope.workspaceRole === 'owner' ||
    scope.workspaceRole === 'admin' ||
    temVisaoCompletaMesa(scope.workspaceRole, member?.funcoes ?? [])

  return {
    memberId: member?.id ?? null,
    funcoes: member?.funcoes ?? [],
    fullAccess,
  }
}

/**
 * Where Prisma para Cliente. Retorna filtro vazio se fullAccess.
 *
 *   const where = { workspaceId, ...whereClienteMesa(mesa) }
 */
export function whereClienteMesa(mesa: MesaScope): Record<string, any> {
  if (mesa.fullAccess) return {}
  if (!mesa.memberId) {
    // Sem membership → não vê nada (defesa em profundidade)
    return { id: '__no_access__' }
  }
  return {
    OR: [
      { responsavelId: mesa.memberId },
      { propostas: { some: { vendedorId: mesa.memberId } } },
      { propostas: { some: { gerenteContaId: mesa.memberId } } },
      { contratos: { some: { vendedorId: mesa.memberId } } },
    ],
  }
}

/**
 * Where Prisma para Proposta. Trader vê propostas onde é vendedor ou
 * gerente da conta, ou pertencentes a clientes onde é responsável.
 */
export function wherePropostaMesa(mesa: MesaScope): Record<string, any> {
  if (mesa.fullAccess) return {}
  if (!mesa.memberId) return { id: '__no_access__' }
  return {
    OR: [
      { vendedorId: mesa.memberId },
      { gerenteContaId: mesa.memberId },
      { autorizadoPorId: mesa.memberId },
      { cliente: { responsavelId: mesa.memberId } },
    ],
  }
}

/**
 * Where Prisma para Contrato.
 */
export function whereContratoMesa(mesa: MesaScope): Record<string, any> {
  if (mesa.fullAccess) return {}
  if (!mesa.memberId) return { id: '__no_access__' }
  return {
    OR: [
      { vendedorId: mesa.memberId },
      { gerenteContaId: mesa.memberId },
      { cliente: { responsavelId: mesa.memberId } },
    ],
  }
}
