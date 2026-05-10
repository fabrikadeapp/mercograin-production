/**
 * QW2/QW3 — Audit log helper.
 *
 * Grava AuditLog de forma idempotente e best-effort: nunca derruba a request
 * principal. Captura IP/User-Agent automaticamente via `next/headers`.
 *
 * Uso típico em route handlers:
 *
 *   import { logAudit } from '@/lib/audit/log'
 *   await logAudit({
 *     userId: scope.userId,
 *     workspaceId: scope.workspaceId,
 *     acao: 'create',
 *     entidade: 'cliente',
 *     entidadeId: created.id,
 *   })
 */
import { db } from '@/lib/db'
import { headers } from 'next/headers'

export type AuditAcao =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'signup'
  | 'view'
  | 'download'
  | string

export interface AuditEvent {
  userId: string
  workspaceId?: string | null
  acao: AuditAcao
  entidade: string
  entidadeId: string
  /** Diff antes/depois para updates, ou snapshot relevante para creates. */
  mudancas?: any
}

export async function logAudit(ev: AuditEvent): Promise<void> {
  try {
    let ipAddress: string | null = null
    let userAgent: string | null = null
    try {
      const h = await headers()
      ipAddress =
        h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        h.get('cf-connecting-ip') ||
        null
      userAgent = h.get('user-agent') || null
    } catch {
      // headers() pode falhar fora de request — ignora
    }

    await db.auditLog.create({
      data: {
        userId: ev.userId,
        acao: ev.acao,
        entidade: ev.entidade,
        entidadeId: ev.entidadeId,
        mudancas: ev.mudancas ?? undefined,
        ipAddress,
        userAgent,
        workspaceId: ev.workspaceId ?? null,
      } as any,
    })
  } catch (e) {
    console.error('[audit]', e)
    // best-effort: nunca falhar a request por causa de log de auditoria
  }
}
