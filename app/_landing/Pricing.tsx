import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { Button, Card, Chip } from '@/components/ui/phb'
import { PRICING } from './data'

export function Pricing() {
  return (
    <section id="precos" className="border-b border-border-1 bg-bg-0">
      <div className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
        <div className="mb-14 max-w-2xl">
          <p className="eyebrow mb-3 text-fg-3">Preços</p>
          <h2 className="font-sans text-h1 font-semibold tracking-tight text-fg-1">
            Trial 10 dias grátis.{' '}
            <span className="text-accent">Cancele quando quiser</span>.
          </h2>
          <p className="mt-4 text-body text-fg-2">
            Validamos seu cartão para liberar o trial. No 11º dia, cobra
            automaticamente. Sem fidelidade.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {PRICING.map((plan) => (
            <Card
              key={plan.id}
              className={
                'relative flex flex-col gap-6 p-7 transition-all ' +
                (plan.highlighted
                  ? 'border-accent ring-1 ring-accent/40 lg:-translate-y-2'
                  : 'hover:border-border-2')
              }
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Chip variant="accent" className="font-semibold tracking-wider">MAIS POPULAR</Chip>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-h3 font-semibold text-fg-1">{plan.name}</h3>
                <p className="text-small text-fg-3">{plan.tagline}</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="t-num-lg font-semibold text-accent">
                  {plan.price}
                </span>
                <span className="text-small text-fg-3">{plan.priceSuffix}</span>
              </div>

              <ul className="flex flex-col gap-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-small text-fg-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-2">
                <Link href={plan.ctaHref}>
                  <Button
                    variant={plan.ctaVariant}
                    size={plan.highlighted ? 'lg' : 'md'}
                    fullWidth
                  >
                    {plan.ctaLabel}
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
