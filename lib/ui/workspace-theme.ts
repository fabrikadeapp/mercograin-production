/**
 * Resolve o design system (tema visual) do workspace ativo para aplicação SSR.
 *
 * Decisão de produto (Jun/2026): o tema é do WORKSPACE (corretora) — todos os
 * usuários daquela corretora veem o mesmo tema. NÃO há override por usuário.
 *
 * Usado em app/layout.tsx para setar `data-theme` no <html> já no SSR, evitando
 * flash e garantindo o tema correto do tenant (sem depender de localStorage).
 *
 * Robusto a contextos sem sessão (landing, login, portal público): cai no
 * tema default sem lançar.
 */
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import {
  normalizeDesignSystem,
  DEFAULT_DESIGN_SYSTEM,
  type DesignSystemSlug,
} from '@/lib/ui/design-systems'

const TTL_MS = 30_000
const cache = new Map<string, { value: DesignSystemSlug; at: number }>()

/**
 * Tema do workspace ativo (ou default se não houver sessão/workspace).
 * Nunca lança — sempre retorna um slug válido.
 */
export async function getWorkspaceDesignSystem(): Promise<DesignSystemSlug> {
  try {
    const scope = await getScope()
    if (!scope?.workspaceId) return DEFAULT_DESIGN_SYSTEM

    const cached = cache.get(scope.workspaceId)
    const now = Date.now()
    if (cached && now - cached.at < TTL_MS) return cached.value

    const ws = await db.workspace.findUnique({
      where: { id: scope.workspaceId },
      select: { designSystem: true },
    })
    const slug = normalizeDesignSystem(ws?.designSystem)
    cache.set(scope.workspaceId, { value: slug, at: now })
    return slug
  } catch {
    return DEFAULT_DESIGN_SYSTEM
  }
}

/** Invalida o cache de tema de um workspace (chamar após salvar nova escolha). */
export function invalidateWorkspaceTheme(workspaceId: string): void {
  cache.delete(workspaceId)
}
