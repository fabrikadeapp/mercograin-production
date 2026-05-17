import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { ZodError } from 'zod'

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
  return apiError(500, 'internal_error', message, { context, cause: err })
}
