/**
 * Helper compartilhado pra route handlers do portal produtor.
 * Lê sessão do cookie e retorna { workspaceId, clienteId } ou null.
 */
import { getPortalSession } from './auth'

export interface PortalScope {
  workspaceId: string
  clienteId: string
  accessId: string
}

export async function requirePortal(): Promise<PortalScope | null> {
  const sess = await getPortalSession()
  if (!sess) return null
  return {
    workspaceId: sess.workspaceId,
    clienteId: sess.clienteId,
    accessId: sess.accessId,
  }
}
