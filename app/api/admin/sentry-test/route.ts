import { NextResponse } from 'next/server'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'
import { captureError, captureMessage } from '@/lib/observability/capture'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/sentry-test
 *
 * Endpoint admin-only para validar que o Sentry está capturando erros.
 * Em produção: dispara um erro intencional via captureException.
 * Em dev: apenas loga no console (Sentry desabilitado).
 *
 * Query params:
 *   ?mode=throw  → lança um erro real (testa boundary do Sentry)
 *   ?mode=capture (default) → chama captureError manualmente
 */
export async function GET(request: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'capture'

    if (mode === 'throw') {
      throw new Error(
        '[sentry-test] Erro intencional disparado em ' + new Date().toISOString(),
      )
    }

    captureMessage('[sentry-test] message de teste', 'info', {
      mode,
      ts: new Date().toISOString(),
    })

    try {
      throw new Error(
        '[sentry-test] Exception intencional capturada manualmente',
      )
    } catch (e) {
      captureError(e, { source: 'sentry-test', mode })
    }

    return NextResponse.json({
      ok: true,
      mode,
      sentryEnabled:
        !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) &&
        process.env.NODE_ENV === 'production',
      env: process.env.NODE_ENV,
      message:
        process.env.NODE_ENV === 'production'
          ? 'Eventos enviados ao Sentry. Verifique o dashboard.'
          : 'Sentry desabilitado em dev — eventos foram logados no console.',
    })
  } catch (e) {
    return adminErrorResponse(e)
  }
}
