import Link from 'next/link'
import { Check, X } from 'lucide-react'
import type { SerializedPlan } from '@/lib/pricing/serialize'

interface PricingProps {
  plans: SerializedPlan[]
}

export function Pricing({ plans }: PricingProps) {
  if (!plans || plans.length === 0) return null

  // Grid: 1 col mobile, 2 col tablet, N col desktop conforme nº de planos.
  const lgCols =
    plans.length === 3
      ? 'lg:grid-cols-3'
      : plans.length === 2
      ? 'lg:grid-cols-2'
      : plans.length >= 4
      ? 'lg:grid-cols-4'
      : 'lg:grid-cols-1'

  return (
    <section id="precos" className="bg-bg-0">
      <div className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
        <div className="mb-16 text-center">
          <p className="eyebrow mb-3 text-fg-3">PREÇOS</p>
          <h2 className="font-sans text-h1 font-semibold tracking-tight text-fg-1 sm:text-[56px] sm:leading-tight">
            Trial {plans[0]?.trialDays ?? 10} dias grátis.{' '}
            <span style={{ color: 'var(--accent)' }}>Cancele quando quiser</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-body text-fg-2">
            Validamos seu cartão para liberar o trial. No 11º dia, cobra automaticamente. Sem fidelidade.
          </p>
        </div>

        <div className={`mx-auto grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-2 ${lgCols} lg:gap-4`}>
          {plans.map((plan) => (
            <div
              key={plan.slug}
              className="relative flex h-full flex-col transition-all duration-300"
              style={{
                background: plan.highlight ? 'var(--bg-3)' : 'var(--bg-1)',
                border: plan.highlight
                  ? '1px solid var(--accent)'
                  : '1px solid var(--border-1)',
                borderRadius: 'var(--r-lg)',
                boxShadow: plan.highlight ? 'var(--shadow-glow)' : 'var(--shadow-card)',
                backdropFilter: 'var(--blur-glass)',
                WebkitBackdropFilter: 'var(--blur-glass)',
                transform: plan.highlight ? 'translateY(-8px)' : undefined,
                zIndex: plan.highlight ? 10 : 1,
              }}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span
                    className="rounded-pill px-4 py-1.5 text-micro font-bold tracking-wider"
                    style={{
                      background: 'var(--accent)',
                      color: 'var(--accent-ink)',
                    }}
                  >
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="px-5 pt-9 pb-5 text-center">
                {plan.tagline && (
                  <p className="eyebrow mb-3 text-fg-3">{plan.tagline}</p>
                )}
                <div className="mb-2 flex items-baseline justify-center">
                  <span className="t-num text-h2 font-semibold text-fg-1">
                    {plan.priceFormatted}
                  </span>
                  <span className="ml-1 text-small text-fg-3">/{plan.intervalLabel}</span>
                </div>
                {plan.description && (
                  <p className="text-small leading-relaxed text-fg-2">{plan.description}</p>
                )}
              </div>

              <div className="flex-1 px-5">
                <p className="eyebrow mb-4 text-fg-3">INCLUSO</p>
                <ul className="space-y-3">
                  {plan.features.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-start gap-2 text-small text-fg-1"
                    >
                      {f.included ? (
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0"
                          style={{ color: 'var(--accent)' }}
                        />
                      ) : (
                        <X
                          className="mt-0.5 h-4 w-4 shrink-0"
                          style={{ color: 'var(--fg-4)' }}
                        />
                      )}
                      <span
                        className={
                          (f.included ? '' : 'text-fg-4') +
                          (f.emphasis ? ' font-semibold' : '')
                        }
                      >
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-5">
                <Link
                  href={plan.ctaHref}
                  className="block w-full rounded-pill py-3 text-center text-small font-medium transition-all"
                  style={
                    plan.highlight
                      ? {
                          background: 'var(--accent)',
                          color: 'var(--accent-ink)',
                          boxShadow: '0 4px 12px rgba(15, 115, 5, 0.25)',
                        }
                      : {
                          background: 'var(--bg-2)',
                          color: 'var(--fg-1)',
                          border: '1px solid var(--border-2)',
                        }
                  }
                >
                  {plan.ctaLabel}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
