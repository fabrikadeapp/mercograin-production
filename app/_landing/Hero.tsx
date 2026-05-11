import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Base gradient — top-to-bottom suave */}
      <div
        aria-hidden
        className="absolute inset-0 -z-30"
        style={{
          background:
            'linear-gradient(180deg, #F4F8F5 0%, #E8EEF0 45%, #DDE5DC 100%)',
        }}
      />

      {/* Aurora blobs — gradients verde+teal flutuantes */}
      <div
        aria-hidden
        className="absolute -z-20 pointer-events-none"
        style={{
          top: '-200px',
          left: '-150px',
          width: '700px',
          height: '700px',
          background:
            'radial-gradient(circle at 50% 50%, rgba(15, 115, 5, 0.25) 0%, rgba(15, 115, 5, 0.10) 35%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        aria-hidden
        className="absolute -z-20 pointer-events-none"
        style={{
          top: '-100px',
          right: '-200px',
          width: '600px',
          height: '600px',
          background:
            'radial-gradient(circle at 50% 50%, rgba(27, 77, 91, 0.28) 0%, rgba(27, 77, 91, 0.12) 35%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      <div
        aria-hidden
        className="absolute -z-20 pointer-events-none"
        style={{
          bottom: '-200px',
          left: '30%',
          width: '800px',
          height: '500px',
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(143, 168, 84, 0.30) 0%, rgba(143, 168, 84, 0.10) 40%, transparent 75%)',
          filter: 'blur(70px)',
        }}
      />

      {/* Mesh grid sutil — sensação de "mesa de operações" */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.18]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(27, 77, 91, 0.12) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(27, 77, 91, 0.12) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
          maskImage:
            'radial-gradient(ellipse at center, black 0%, black 50%, transparent 85%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at center, black 0%, black 50%, transparent 85%)',
        }}
      />

      {/* Noise grain pra textura premium */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Content */}
      <div className="relative mx-auto flex min-h-[92vh] max-w-7xl flex-col items-center justify-center px-4 py-24 text-center md:px-8 md:py-32">
        <div
          className="mb-8 inline-flex items-center gap-2 rounded-pill px-4 py-1.5 text-micro font-medium"
          style={{
            background: 'rgba(255, 255, 255, 0.7)',
            border: '1px solid var(--border-1)',
            color: 'var(--fg-2)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
          Mesa de operações para tradings de grãos
        </div>

        <h1 className="max-w-5xl font-sans text-[44px] font-semibold leading-[1.02] tracking-[-0.03em] text-fg-1 sm:text-[64px] md:text-[88px]">
          Sua{' '}
          <span
            style={{
              background:
                'linear-gradient(120deg, #0F7305 0%, #1B4D5B 60%, #0F7305 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            mesa de operações
          </span>
          <br className="hidden sm:inline" />
          {' '}em tempo real.
        </h1>

        <p className="mt-8 max-w-[60ch] text-body text-fg-2 sm:text-h3 sm:leading-snug">
          Cotações ao vivo CEPEA, contratos digitais, fluxo de caixa e
          WhatsApp Bot — a precisão que sua corretora de grãos precisa para
          operar a safra inteira.
        </p>

        <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/auth/signup?plan=pro"
            className="inline-flex items-center gap-2 rounded-pill px-8 py-4 text-body font-medium shadow-lg transition-all hover:shadow-xl hover:scale-[1.02]"
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              boxShadow: '0 8px 24px rgba(15, 115, 5, 0.28)',
            }}
          >
            Começar trial grátis
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="#precos"
            className="inline-flex items-center gap-2 rounded-pill px-6 py-4 text-body font-medium transition-all hover:bg-white/40"
            style={{ color: 'var(--fg-1)' }}
          >
            Ver preços
          </Link>
        </div>

        {/* Trust strip */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-small text-fg-3">
          <span className="t-num text-fg-2">+312 contratos/mês ativos</span>
          <span style={{ color: 'var(--border-2)' }}>·</span>
          <span className="t-num text-fg-2">R$ 18,4M em negociação</span>
          <span style={{ color: 'var(--border-2)' }}>·</span>
          <span>CEPEA · ESALQ · B3</span>
        </div>
      </div>
    </section>
  )
}
