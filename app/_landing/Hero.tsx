import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-bg-0">
      <div className="relative mx-auto flex min-h-[88vh] max-w-7xl flex-col items-center px-4 pt-20 pb-0 md:px-8 md:pt-28">
        <h1 className="max-w-5xl text-center font-sans text-[44px] font-semibold leading-[1.02] tracking-[-0.03em] text-fg-1 sm:text-[64px] md:text-[80px]">
          Sua{' '}
          <span style={{ color: 'var(--accent)' }}>mesa de operações</span>
          <br className="hidden sm:inline" />
          {' '}em tempo real.
        </h1>

        <p className="mt-8 max-w-[60ch] text-center text-body text-fg-2 sm:text-h3 sm:leading-snug">
          Cotações ao vivo CEPEA, contratos digitais, fluxo de caixa e
          WhatsApp Bot — a precisão que sua corretora de grãos precisa para
          operar a safra inteira.
        </p>

        <div className="mt-10">
          <Link
            href="/auth/signup?plan=pro"
            className="inline-flex items-center gap-2 rounded-pill px-8 py-4 text-body font-medium shadow-lg transition-all hover:shadow-xl"
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
            }}
          >
            Começar trial grátis
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Imagem full-bleed: campo de grãos brasileiro */}
        <div
          className="relative mt-16 w-screen left-1/2 -translate-x-1/2 overflow-hidden"
          style={{ height: 'clamp(320px, 50vh, 560px)' }}
        >
          <picture>
            <source
              media="(min-width: 1024px)"
              srcSet="https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=2400&q=80"
            />
            <img
              src="https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=1600&q=80"
              alt="Plantação de soja no Brasil"
              className="absolute inset-0 h-full w-full object-cover"
              loading="eager"
            />
          </picture>
          {/* fade superior pra blending com fundo */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24"
            style={{
              background:
                'linear-gradient(180deg, var(--bg-0) 0%, transparent 100%)',
            }}
          />
        </div>
      </div>
    </section>
  )
}
