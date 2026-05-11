export function ScreenshotShowcase() {
  return (
    <section id="demo" className="bg-bg-0">
      <div className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
        <div className="mb-14 max-w-2xl">
          <p className="eyebrow mb-3 text-fg-3">DEMONSTRAÇÃO</p>
          <h2 className="font-sans text-h1 font-semibold tracking-tight text-fg-1 sm:text-[48px] sm:leading-tight">
            Sua mesa, num único painel.
          </h2>
          <p className="mt-4 text-body text-fg-2">
            Tudo que importa, sem distrações. Veja por dentro:
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-[1100px]">
          <div
            className="relative aspect-[16/10] w-full overflow-hidden"
            style={{
              borderRadius: 'var(--r-lg)',
              border: '1px solid var(--border-1)',
              background: 'var(--bg-3)',
              boxShadow: 'var(--shadow-floating)',
            }}
          >
            {/* faux browser toolbar */}
            <div
              className="absolute left-0 right-0 top-0 z-10 flex h-9 items-center gap-1.5 px-3"
              style={{
                borderBottom: '1px solid var(--border-1)',
                background: 'var(--bg-2)',
              }}
            >
              <span className="h-2.5 w-2.5 rounded-pill" style={{ background: 'var(--neg)' }} />
              <span className="h-2.5 w-2.5 rounded-pill" style={{ background: 'var(--warn)' }} />
              <span className="h-2.5 w-2.5 rounded-pill" style={{ background: 'var(--pos)' }} />
              <span className="ml-3 font-mono text-micro" style={{ color: 'var(--fg-4)' }}>
                www.profitsync.ia.br/dashboard
              </span>
            </div>

            {/* screenshot — img simples evita issues com next/image+fill */}
            <img
              src="/landing/dashboard-preview.png"
              alt="Dashboard BH Grain — cotações ao vivo, book de futuros e mercado CBOT"
              className="absolute inset-0 w-full h-full object-cover object-top"
              style={{ paddingTop: 36 }}
              loading="eager"
              decoding="async"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
