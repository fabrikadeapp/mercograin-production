import { auth } from '@/auth'
import { db as prisma } from '@/lib/db'
import { headers } from 'next/headers'

export interface ScopeCtx {
  userId: string
  workspaceId: string
  /** Role no workspace: owner | admin | member | viewer */
  workspaceRole: string
  /** Superadmin global (User.role === 'admin') */
  isAdmin: boolean
  /** É owner do workspace ativo */
  isWorkspaceOwner: boolean
  /** Filtro de ownership por workspace. Em scope=all (admin), retorna apenas extras. */
  whereOwn<T extends Record<string, any> = Record<string, any>>(
    extra?: T
  ): T & { workspaceId?: string }
  /** Filtro via path de relação (ex.: 'cliente'). */
  whereOwnVia<T extends Record<string, any> = Record<string, any>>(
    relationPath: string,
    extra?: T
  ): T & Record<string, any>
}

/**
 * Resolve o workspace ativo do user.
 * Ordem: header X-Workspace-Id (validado) → primeiro owned → primeira membership ativa.
 * Cria workspace owned automaticamente se o user não tiver nenhum (auto-onboarding mínimo).
 */
export async function getActiveWorkspace(userId: string): Promise<{
  workspaceId: string
  role: string
  isOwner: boolean
} | null> {
  // 1. Header opcional
  let requestedWsId: string | null = null
  try {
    const h = await headers()
    requestedWsId = h.get('x-workspace-id')
  } catch {
    // headers() pode falhar fora de request — ignora
  }

  if (requestedWsId) {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: requestedWsId, userId, status: 'active' },
      include: { workspace: true },
    })
    if (member) {
      return {
        workspaceId: member.workspaceId,
        role: member.role,
        isOwner: member.workspace.ownerId === userId,
      }
    }
  }

  // 2. Workspace owned
  const owned = await prisma.workspace.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: 'asc' },
  })
  if (owned) {
    return { workspaceId: owned.id, role: 'owner', isOwner: true }
  }

  // 3. Qualquer membership ativa
  const member = await prisma.workspaceMember.findFirst({
    where: { userId, status: 'active' },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  })
  if (member) {
    return {
      workspaceId: member.workspaceId,
      role: member.role,
      isOwner: member.workspace.ownerId === userId,
    }
  }

  return null
}

/**
 * Carrega sessão, role e workspace ativo. Lê do JWT primeiro (rápido) e só
 * faz query DB se faltar dado essencial (legado / sessão antiga sem
 * activeWorkspaceId).
 *
 * Permite override via header X-Workspace-Id (validado contra membership).
 */
export async function getScope(
  searchParams?: URLSearchParams
): Promise<ScopeCtx | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  const u = session.user as any
  const isAdmin = u.role === 'admin'
  const wantAllScope = isAdmin && searchParams?.get('scope') === 'all'

  // Caminho rápido: JWT tem todos os dados que precisamos
  const tokenWsId = u.activeWorkspaceId as string | null | undefined
  const tokenRole = u.workspaceRole as string | null | undefined
  const tokenIsOwner = u.isWorkspaceOwner as boolean | undefined

  // Override por header (admin trocando workspace)
  let requestedWsId: string | null = null
  try {
    const h = await headers()
    requestedWsId = h.get('x-workspace-id')
  } catch {
    // headers() pode falhar fora de request — ignora
  }

  // Se há header diferente do JWT, ou JWT está vazio, cai no fluxo lento
  let workspaceId = tokenWsId ?? null
  let workspaceRole = tokenRole ?? null
  let isOwner = !!tokenIsOwner

  if (requestedWsId && requestedWsId !== tokenWsId) {
    // Trocou workspace — valida membership e atualiza
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: requestedWsId, userId: u.id, status: 'active' },
      include: { workspace: { select: { ownerId: true } } },
    })
    if (member) {
      workspaceId = member.workspaceId
      workspaceRole = member.role
      isOwner = member.workspace.ownerId === u.id
    }
  } else if (!workspaceId) {
    // JWT antigo sem activeWorkspaceId — fallback lento
    const ws = await getActiveWorkspace(u.id)
    if (!ws) return null
    workspaceId = ws.workspaceId
    workspaceRole = ws.role
    isOwner = ws.isOwner
  }

  if (!workspaceId || !workspaceRole) return null

  return {
    userId: u.id,
    workspaceId,
    workspaceRole,
    isAdmin,
    isWorkspaceOwner: isOwner,
    whereOwn(extra?: any) {
      if (wantAllScope) return { ...(extra || {}) }
      return { workspaceId, ...(extra || {}) }
    },
    whereOwnVia(relationPath: string, extra?: any) {
      if (wantAllScope) return { ...(extra || {}) }
      const parts = relationPath.split('.')
      let nested: any = { workspaceId }
      for (let i = parts.length - 1; i >= 0; i--) {
        nested = { [parts[i]]: nested }
      }
      return { ...nested, ...(extra || {}) }
    },
  }
}

/**
 * Throws if there is no session/workspace — caller should translate into 401/403.
 */
export async function requireScope(
  searchParams?: URLSearchParams
): Promise<ScopeCtx> {
  const s = await getScope(searchParams)
  if (!s) throw new Error('Não autorizado')
  return s
}
