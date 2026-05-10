import * as Sentry from '@sentry/nextjs'

/**
 * Captura um erro para o Sentry (em produção) ou loga no console (em dev).
 * Sentry é opcional: sem DSN configurado, esta função apenas loga.
 */
export function captureError(error: unknown, context?: Record<string, any>) {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[error]', error, context)
    return
  }
  Sentry.captureException(error, { extra: context })
}

/**
 * Captura uma mensagem (info/warning/error) para o Sentry ou console.
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[${level}]`, message, context)
    return
  }
  Sentry.captureMessage(message, { level, extra: context })
}
