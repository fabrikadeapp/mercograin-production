/**
 * withAudit — helper que injeta contexto de audit log em handlers.
 *
 * Uso (substitui o try/catch padrão):
 *
 *   export const POST = withAudit('create-proposta', async (req, scope) => {
 *     const proposta = await db.proposta.create({ ... })
 *     return NextResponse.json(proposta)
 *   })
 *
 * O wrapper:
 *  1. Resolve scope (auth)
 *  2. Inicia AsyncLocalStorage com userId + workspaceId
 *  3. Todas as queries Prisma feitas dentro são auto-auditadas
 *  4. Erros padronizados via serverError
 */

import { NextRequest, NextResponse } from 'next/server'
import { getScope, type ScopeCtx } from '@/lib/auth/scope'
import { runWithAudit } from '@/lib/db/audit-extension'
import { serverError, unauthorized } from './error-response'

export type AuditedHandler<C = any> = (
  req: NextRequest,
  scope: ScopeCtx,
  ctx: C,
) => Promise<Response>

export function withAudit<C = any>(
  source: string,
  handler: AuditedHandler<C>,
): (req: NextRequest, ctx: C) => Promise<Response> {
  return async (req, ctx: C) => {
    try {
      const scope = await getScope()
      if (!scope) return unauthorized()
      return await runWithAudit(
        {
          userId: scope.userId,
          workspaceId: scope.workspaceId,
          source: source.startsWith('cron.') ? 'cron' : 'api',
        },
        () => handler(req, scope, ctx),
      )
    } catch (err) {
      return serverError(err, source)
    }
  }
}
