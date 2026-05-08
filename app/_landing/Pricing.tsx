import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { Button, Card, Chip } from '@/components/ui/phb'
import { loadActivePlans } from '@/lib/pricing/serialize'

export const dynamic = 'force-dynamic'

function ctaVariant(highlight: boolean, idx: number): 'primary' | 'ghost' | 'secondary' {
  if (highlight) return 'primary'
  // Padrão antigo: 1º plano "secondary", último (>=3) "ghost"
  if (idx === 0) return 'secondary'
  return 'ghost'
}

export async function Pricing() {
  const plans = await loadActivePlans()

  if (plans.length === 0) {
    return (
      <section id="precos" className="border-b border-border-1 bg-bg-0">
        <div className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
          <p className="text-fg-3 text-small">Planos em configuração.</p>
        </div>
      </section>
    )
  }

  return (
    <section id="precos" className="border-b border-border-1 bg-bg-0">
      <div className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
        <div className="mb-14 max-w-2xl">
          <p className="eyebrow mb-3 text-fg-3">Preços</p>
          <h2 className="font-sans text-h1 font-semibold tracking-tight text-fg-1">
            Trial {plans[0]?.trialDays ?? 10} dias grátis.{' '}
            <span className="text-accent">Cancele quando quiser</span>.
          </h2>
          <p className="mt-4 text-body text-fg-2">
            Validamos seu cartão para liberar o trial. No 11º dia, cobra
            automaticamente. Sem fidelidade.
          </p>
        </div>

        <div
          className="grid grid-cols-1 gap-5"
          style={{
            gridTemplateColumns:
              plans.length === 1
                ? '1fr'
                : plans.length === 2
                ? 'repeat(2, minmax(0, 1fr))'
                : `repeat(${Math.min(plans.length, 3)}, minmax(0, 1fr))`,
          }}
        >
          {plans.map((plan, idx) => {
            const variant = ctaVariant(plan.highlight, idx)
            return (
              <Card
                key={plan.id}
                className={
                  'relative flex flex-col gap-6 p-7 transition-all ' +
                  (plan.highlight
                    ? 'border-accent ring-1 ring-accent/40 lg:-translate-y-2'
                    : 'hover:border-border-2')
                }
              >
                {plan.badge ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Chip variant="accent" className="font-semibold tracking-wider">
                      {plan.badge}
                    </Chip>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <h3 className="text-h3 font-semibold text-fg-1">
                    {plan.shortName}
                  </h3>
                  {plan.tagline ? (
                    <p className="text-small text-fg-3">{plan.tagline}</p>
                  ) : null}
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="t-num-lg font-semibold text-accent">
                    {plan.priceFormattedShort}
                  </span>
                  <span className="text-small text-fg-3">
                    {plan.intervalLabel}
                  </span>
                </div>

                <ul className="flex flex-col gap-3">
                  {plan.includedFeatures.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-start gap-2.5 text-small text-fg-2"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <span className={f.emphasis ? 'font-semibold text-fg-1' : ''}>
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-2">
                  <Link href={plan.ctaHref}>
                    <Button
                      variant={variant}
                      size={plan.highlight ? 'lg' : 'md'}
                      fullWidth
                    >
                      {plan.ctaLabel}
                    </Button>
                  </Link>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
