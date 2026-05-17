import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { ZodError } from 'zod'
import { captureError } from '@/lib/observability/capture'

export interface ApiErrorBody {
  error: string
  code: string
  requestId: string
  details?: unknown
}

/**
 * Resposta de erro padronizada para APIs.
 *
 * Inclui:
 *  - code: identificador legível ("validation_failed", "not_found", etc)
 *  - requestId: UUID pra correlacionar com logs
 *  - details: payload opcional (ex.: issues do Zod)
 *
 * Sempre chame com um contexto pra logging.
 */
export function apiError(
  status: number,
  code: string,
  message: string,
  options: {
    details?: unknown
    context?: string
    cause?: unknown
  } = {},
): NextResponse<ApiErrorBody> {
  const requestId = randomUUID()
  if (options.context) {
    console.error(
      `[api:error] ${options.context} code=${code} reqId=${requestId}`,
      options.cause,
    )
  }
  return NextResponse.json(
    {
      error: message,
      code,
      requestId,
      ...(options.details !== undefined ? { details: options.details } : {}),
    },
    { status },
  )
}

/** 401 helper */
export const unauthorized = (msg = 'Não autorizado') =>
  apiError(401, 'unauthorized', msg)

/** 403 helper */
export const forbidden = (msg = 'Sem permissão') =>
  apiError(403, 'forbidden', msg)

/** 404 helper */
export const notFound = (msg = 'Não encontrado') =>
  apiError(404, 'not_found', msg)

/** Tradução padrão para ZodError */
export function zodError(err: ZodError, context?: string) {
  return apiError(400, 'validation_failed', err.errors[0]?.message ?? 'Dados inválidos', {
    details: err.errors,
    context,
    cause: err,
  })
}

/** Catch genérico — use em try/catch outer */
export function serverError(err: unknown, context: string) {
  const message =
    err instanceof Error ? err.message : 'Erro interno do servidor'
  // Sentry capture além do log local
  try {
    captureError(err, { where: context })
  } catch {}
  return apiError(500, 'internal_error', message, { context, cause: err })
}

/**
 * Wrapper de handler — substitui boilerplate `try { ... } catch { genérico }`.
 * Uso:
 *   export const GET = withApiError('clientes.list', async (req) => {
 *     const data = await db.cliente.findMany(...)
 *     return NextResponse.json(data)
 *   })
 */
export function withApiError<Args extends unknown[]>(
  context: string,
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args)
    } catch (err) {
      if (err instanceof ZodError) return zodError(err, context)
      // Erros conhecidos por mensagem
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === 'Não autorizado' || msg === 'unauthorized') {
        return unauthorized()
      }
      return serverError(err, context)
    }
  }
}
