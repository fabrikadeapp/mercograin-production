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

  // Security headers — aplicam em TODAS as rotas
  async headers() {
    const ContentSecurityPolicy = [
      "default-src 'self'",
      // Next.js + Sentry + Stripe + libs JS in-line necessárias
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.sentry.io https://browser.sentry-cdn.com",
      // Tailwind / styled-jsx geram inline styles
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      // APIs externas: Stripe, Resend, OpenRouter, Groq, Yahoo, CEPEA
      "connect-src 'self' https://api.stripe.com https://*.sentry.io https://api.resend.com https://openrouter.ai https://api.groq.com https://api.openai.com https://yfapi.net https://query1.finance.yahoo.com https://economia.awesomeapi.com.br https://api.bcb.gov.br https://www.cepea.esalq.usp.br",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join('; ')

    const securityHeaders = [
      { key: 'Content-Security-Policy', value: ContentSecurityPolicy },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
      },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
    ]

    return [
      {
        // Aplica em todas as rotas, exceto webhooks (que precisam aceitar
        // posts cross-origin do Stripe/Evolution/Twilio)
        source: '/((?!api/webhooks).*)',
        headers: securityHeaders,
      },
    ]
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
