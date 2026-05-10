const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
}

// Sentry é opcional: se SENTRY_DSN/NEXT_PUBLIC_SENTRY_DSN não estiverem definidos,
// os SDKs entram em modo no-op (enabled: false). O wrapper apenas adiciona
// upload de source maps quando SENTRY_AUTH_TOKEN está presente.
module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
})
// Cache bust - qua 29 abr 2026 22:48:55 -03
