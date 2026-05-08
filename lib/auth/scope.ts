import { auth } from '@/auth'
import { db as prisma } from '@/lib/db'

export interface ScopeCtx {
  userId: string
  isAdmin: boolean
  /** When the caller is admin and `?scope=all` was passed, this returns no ownership filter (just the extra filters). Otherwise it injects `{ usuarioId }`. */
  whereOwn<T extends Record<string, any> = Record<string, any>>(
    extra?: T
  ): T & { usuarioId?: string }
  /** Same idea, but for relations where the owner sits on a parent (e.g. Proposta.cliente.usuarioId). */
  whereOwnVia<T extends Record<string, any> = Record<string, any>>(
    relationPath: string,
    extra?: T
  ): T & Record<string, any>
}

/**
 * Loads the session, re-fetches the user to get an up-to-date role and
 * returns the multi-tenant scope context. Returns null if there is no session.
 */
export async function getScope(
  searchParams?: URLSearchParams
): Promise<ScopeCtx | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  })
  if (!user) return null

  const isAdmin = user.role === 'admin'
  const wantAllScope = isAdmin && searchParams?.get('scope') === 'all'

  return {
    userId: user.id,
    isAdmin,
    whereOwn(extra?: any) {
      if (wantAllScope) return { ...(extra || {}) }
      return { usuarioId: user.id, ...(extra || {}) }
    },
    whereOwnVia(relationPath: string, extra?: any) {
      if (wantAllScope) return { ...(extra || {}) }
      // Build nested object e.g. { cliente: { usuarioId: user.id } }
      const parts = relationPath.split('.')
      let nested: any = { usuarioId: user.id }
      for (let i = parts.length - 1; i >= 0; i--) {
        nested = { [parts[i]]: nested }
      }
      return { ...nested, ...(extra || {}) }
    },
  }
}

/**
 * Throws if there is no session — caller should translate into a 401.
 */
export async function requireScope(
  searchParams?: URLSearchParams
): Promise<ScopeCtx> {
  const s = await getScope(searchParams)
  if (!s) throw new Error('Não autorizado')
  return s
}
