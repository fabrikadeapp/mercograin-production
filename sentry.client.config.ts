import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled:
    !!process.env.NEXT_PUBLIC_SENTRY_DSN &&
    process.env.NODE_ENV === 'production',
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,
  beforeSend(event) {
    // Filtra erros em dev/preview
    if (process.env.NODE_ENV !== 'production') return null
    return event
  },
})
