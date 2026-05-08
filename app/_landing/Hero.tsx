import Link from 'next/link'
import { Button } from '@/components/ui/phb'
import { ArrowRight } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border-1 bg-bg-0">
      {/* glow ambient */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto flex min-h-[80vh] max-w-7xl flex-col items-center justify-center px-4 py-24 text-center md:px-8 md:py-32">
        <p className="eyebrow mb-6 text-fg-3">
          TRADING DE GRÃOS · MESA DE OPERAÇÕES
        </p>

        <h1 className="max-w-4xl font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] text-fg-1 sm:text-[56px]">
          Toda sua mesa de operações{' '}
          <span className="text-accent">em um só lugar</span>.
        </h1>

        <p className="mt-6 max-w-[60ch] text-body text-fg-2">
          Cotações ao vivo CEPEA, contratos, fluxo de caixa, WhatsApp Bot e
          relatórios — desenhados para tradings que precisam de precisão
          financeira e controle total da safra.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/auth/signup?plan=pro">
            <Button variant="primary" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Iniciar trial grátis · 10 dias
            </Button>
          </Link>
          <a href="#demo">
            <Button variant="ghost" size="lg">Ver demonstração</Button>
          </a>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-small text-fg-3">
          <span className="t-num text-fg-2">+312 contratos/mês ativos</span>
          <span className="text-border-2">·</span>
          <span className="t-num text-fg-2">R$ 18,4M em negociação</span>
          <span className="text-border-2">·</span>
          <span>CEPEA</span>
          <span className="text-border-2">·</span>
          <span>ESALQ</span>
          <span className="text-border-2">·</span>
          <span>B3</span>
        </div>
      </div>
    </section>
  )
}
