/**
 * Rate limit pra mutations sensíveis (criar/atualizar/deletar entidades
 * financeiras).
 *
 * Política default: 20 mutations por minuto por (user|ip)+entidade.
 *
 * Uso em handlers:
 *
 *   export async function POST(req: Request) {
 *     const scope = await getScope()
 *     const limit = checkMutationLimit('proposta.create', scope?.userId ?? getClientIp(req))
 *     if (!limit.ok) return rateLimited(limit)
 *     // ... resto do handler
 *   }
 */

import { NextResponse } from 'next/server'
import { rateLimit, type RateLimitResult } from './rate-limit'

export const MUTATION_LIMITS = {
  // Limites por minuto
  // entidades financeiras: 20/min (trader ativo)
  'proposta.create': { max: 20, windowMs: 60_000 },
  'proposta.update': { max: 30, windowMs: 60_000 },
  'proposta.delete': { max: 10, windowMs: 60_000 },
  'proposta.autorizar': { max: 30, windowMs: 60_000 },

  'contrato.create': { max: 20, windowMs: 60_000 },
  'contrato.update': { max: 30, windowMs: 60_000 },
  'contrato.delete': { max: 5, windowMs: 60_000 },

  'boleto.create': { max: 30, windowMs: 60_000 },
  'boleto.update': { max: 30, windowMs: 60_000 },

  'movimento.create': { max: 30, windowMs: 60_000 },
  'movimento.update': { max: 30, windowMs: 60_000 },

  'comissao.update': { max: 30, windowMs: 60_000 },
  'comissao.cobrar': { max: 20, windowMs: 60_000 },

  // Membership: poucas operações por minuto
  'member.invite': { max: 10, windowMs: 60_000 },
  'member.update': { max: 20, windowMs: 60_000 },
  'member.delete': { max: 10, windowMs: 60_000 },
  'member.transfer-carteira': { max: 5, windowMs: 60_000 },

  // Laura ingest (webhooks externos): mais alto
  'laura.ingest': { max: 60, windowMs: 60_000 },

  // Workspace admin
  'workspace.feature-toggle': { max: 20, windowMs: 60_000 },
  'workspace.codigo': { max: 5, windowMs: 60_000 },
} as const

export type MutationOp = keyof typeof MUTATION_LIMITS

export function checkMutationLimit(
  op: MutationOp,
  identity: string,
): RateLimitResult {
  const config = MUTATION_LIMITS[op]
  return rateLimit(`mut:${op}:${identity}`, config.max, config.windowMs)
}

/** Helper response 429 padronizada. */
export function rateLimited(limit: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: 'rate_limit_exceeded',
      message: 'Muitas requisições. Tente novamente em alguns instantes.',
      retryAfterSec: Math.ceil(limit.resetIn / 1000),
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil(limit.resetIn / 1000)),
      },
    },
  )
}
