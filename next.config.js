const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Cache em-memória (Railway filesystem é read-only fora do /data)
  cacheHandler: require.resolve('./cache-handler.js'),
  cacheMaxMemorySize: 0, // desabilita LRU interno (nosso handler já gerencia)
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
  images: {
    // Imagens agora vêm de /api/files (same-origin). Patterns vazios
    // bloqueiam <Image src="https://...">; deixamos um pattern aberto pra
    // URLs externas confiáveis (Sentry user avatars etc).
    remotePatterns: [],
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
