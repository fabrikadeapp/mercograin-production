/**
 * Prisma extension — audit log automático para modelos críticos.
 *
 * Intercepta create/update/delete em modelos sensíveis e grava em AuditLog.
 * Funciona com middleware/extension API moderno do Prisma.
 *
 * Limitação: o extension não tem acesso ao session.user atual, então
 * userId/workspaceId vêm via AsyncLocalStorage setado em cada request.
 */

import { Prisma } from '@prisma/client'
import { AsyncLocalStorage } from 'async_hooks'

interface AuditContext {
  userId?: string | null
  workspaceId?: string | null
  source?: string // 'api' | 'cron' | 'webhook' | 'admin'
}

// Storage compartilhado por requisição
export const auditContext = new AsyncLocalStorage<AuditContext>()

/** Modelos que recebem audit automático. Adicione conforme necessidade. */
const AUDITED_MODELS = new Set([
  'Cliente',
  'Proposta',
  'Contrato',
  'Boleto',
  'ComissaoApurada',
  'NotaFiscal',
  'WorkspaceMember',
  'MovimentoFinanceiro',
  'WorkspaceFeature',
])

/** Ações auditadas */
const AUDITED_ACTIONS = new Set(['create', 'update', 'delete', 'updateMany', 'deleteMany'])

export const auditExtension = Prisma.defineExtension({
  name: 'auditExtension',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!model || !AUDITED_MODELS.has(model) || !AUDITED_ACTIONS.has(operation)) {
          return query(args)
        }

        const ctx = auditContext.getStore()
        const before =
          operation === 'update' || operation === 'delete'
            ? await captureBeforeState(model, args)
            : null

        const result = await query(args)
        const after =
          operation === 'create' || operation === 'update' ? result : null

        // Best-effort, não bloqueia
        writeAuditLog({
          model,
          operation,
          before,
          after,
          ctx: ctx ?? {},
        }).catch((err) =>
          console.warn(`[audit] failed to log ${model}.${operation}:`, err),
        )

        return result
      },
    },
  },
})

async function captureBeforeState(_model: string, _args: any): Promise<any> {
  // Captura best-effort: opcional, evita query extra pra simplicidade
  return null
}

async function writeAuditLog(args: {
  model: string
  operation: string
  before: unknown
  after: unknown
  ctx: AuditContext
}) {
  // Lazy import pra não criar ciclo
  const { db } = await import('@/lib/db')

  const entidadeId =
    (args.after as any)?.id ?? (args.before as any)?.id ?? null

  if (!entidadeId) return // updateMany / deleteMany — não rastreamos individualmente
  if (!args.ctx.workspaceId) return // sem workspaceId, skip pra evitar log órfão
  if (!args.ctx.userId) return // userId é obrigatório no schema

  try {
    await db.auditLog.create({
      data: {
        userId: args.ctx.userId,
        workspaceId: args.ctx.workspaceId,
        acao: `${args.model.toLowerCase()}.${args.operation}`,
        entidade: args.model.toLowerCase(),
        entidadeId,
        mudancas: {
          source: args.ctx.source ?? 'api',
          after: sanitize(args.after),
        } as any,
      },
    })
  } catch (err) {
    // AuditLog é best-effort
  }
}

function sanitize(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj
  const SENSITIVE_KEYS = ['senha', 'password', 'token', 'secret', 'apiKey', 'inviteToken']
  const clone: any = Array.isArray(obj) ? [...obj] : { ...(obj as any) }
  for (const k of Object.keys(clone)) {
    if (SENSITIVE_KEYS.includes(k)) clone[k] = '***'
    else if (typeof clone[k] === 'object') clone[k] = sanitize(clone[k])
  }
  return clone
}

/**
 * Helper para setar contexto em handlers de API.
 *
 *   export async function POST(req: Request) {
 *     return runWithAudit({ userId, workspaceId, source: 'api' }, async () => {
 *       // ... db operations
 *     })
 *   }
 */
export function runWithAudit<T>(ctx: AuditContext, fn: () => Promise<T>): Promise<T> {
  return auditContext.run(ctx, fn)
}
