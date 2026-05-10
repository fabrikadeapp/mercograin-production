import Image from 'next/image'

export function ScreenshotShowcase() {
  return (
    <section id="demo" className="border-b border-border-1 bg-bg-1">
      <div className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
        <div className="mb-14 max-w-2xl">
          <p className="eyebrow mb-3 text-fg-3">Demonstração</p>
          <h2 className="font-sans text-h1 font-semibold tracking-tight text-fg-1">
            Sua mesa, num único painel.
          </h2>
          <p className="mt-4 text-body text-fg-2">
            Tudo que importa, sem distrações. Veja por dentro:
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-[1100px]">
          {/* glow ring */}
          <div
            aria-hidden
            className="absolute -inset-8 rounded-2xl opacity-30 blur-3xl"
            style={{
              background:
                'radial-gradient(ellipse at center, var(--accent) 0%, transparent 65%)',
            }}
          />
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-border-2 bg-bg-2 shadow-card">
            {/* faux browser toolbar */}
            <div className="absolute left-0 right-0 top-0 z-10 flex h-9 items-center gap-1.5 border-b border-border-1 bg-bg-3 px-3">
              <span className="h-2.5 w-2.5 rounded-full bg-neg/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-warn/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-pos/80" />
              <span className="ml-3 text-micro text-fg-4 font-mono">
                www.profitsync.ia.br/dashboard
              </span>
            </div>

            {/* screenshot real do dashboard */}
            <Image
              src="/landing/dashboard-preview.png"
              alt="Dashboard PHB Grain — cotações ao vivo, book de futuros e mercado CBOT"
              fill
              className="object-cover object-top pt-9"
              priority
              sizes="(min-width: 1100px) 1100px, 100vw"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
