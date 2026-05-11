import Link from 'next/link'
import { Check, X } from 'lucide-react'

interface Feature {
  text: string
  included: boolean
}

interface Tier {
  slug: string
  name: string
  subtitle: string
  price: string
  period?: string
  description: string
  features: Feature[]
  ctaLabel: string
  ctaHref: string
  highlighted?: boolean
  badge?: string
}

const TIERS: Tier[] = [
  {
    slug: 'free',
    name: 'Free',
    subtitle: 'DEMO',
    price: 'R$ 0',
    period: '/mês',
    description: 'Para conhecer a plataforma — cotações ao vivo e até 5 contratos.',
    features: [
      { text: 'Cotações CEPEA ao vivo', included: true },
      { text: 'Até 5 contratos / mês', included: true },
      { text: '1 usuário', included: true },
      { text: 'WhatsApp Bot', included: false },
      { text: 'Suporte prioritário', included: false },
    ],
    ctaLabel: 'Criar conta grátis',
    ctaHref: '/auth/signup?plan=free',
  },
  {
    slug: 'starter',
    name: 'Starter',
    subtitle: 'CORRETOR SOLO',
    price: 'R$ 297',
    period: '/mês',
    description: 'Para o corretor autônomo que opera safra inteira sozinho.',
    features: [
      { text: 'Cotações + Curvas históricas', included: true },
      { text: 'Contratos ilimitados', included: true },
      { text: 'Fluxo de caixa básico', included: true },
      { text: '1 usuário', included: true },
      { text: 'WhatsApp Bot', included: false },
    ],
    ctaLabel: 'Começar trial 10 dias',
    ctaHref: '/auth/signup?plan=starter',
  },
  {
    slug: 'pro',
    name: 'Pro',
    subtitle: 'CORRETORA PEQUENA',
    price: 'R$ 897',
    period: '/mês',
    description: 'Para corretoras de até 5 operadores que precisam escalar com controle.',
    features: [
      { text: 'Tudo do Starter +', included: true },
      { text: 'Até 5 usuários', included: true },
      { text: 'WhatsApp Bot incluso', included: true },
      { text: 'Hedge + Risco', included: true },
      { text: 'Relatórios DRE & C-Level', included: true },
    ],
    ctaLabel: 'Começar trial 10 dias',
    ctaHref: '/auth/signup?plan=pro',
    highlighted: true,
    badge: 'MAIS POPULAR',
  },
  {
    slug: 'business',
    name: 'Business',
    subtitle: 'CORRETORA MÉDIA',
    price: 'R$ 2.497',
    period: '/mês',
    description: 'Para corretoras de até 20 operadores com operação física e fiscal.',
    features: [
      { text: 'Tudo do Pro +', included: true },
      { text: 'Até 20 usuários', included: true },
      { text: 'Operação física + Romaneios', included: true },
      { text: 'NF-e + SPED + Fiscal completo', included: true },
      { text: 'EUDR + Compliance', included: true },
    ],
    ctaLabel: 'Começar trial 10 dias',
    ctaHref: '/auth/signup?plan=business',
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    subtitle: 'TRADINGS GRANDES',
    price: 'R$ 4.997',
    period: '/mês +',
    description: 'A partir de — base + add-ons conforme volume e integrações.',
    features: [
      { text: 'Tudo do Business +', included: true },
      { text: 'Usuários ilimitados', included: true },
      { text: 'SSO / SAML / SCIM', included: true },
      { text: 'SLA 99,9% + Suporte 24/7', included: true },
      { text: 'Integrações ERP customizadas', included: true },
    ],
    ctaLabel: 'Falar com vendas',
    ctaHref: '/contato?assunto=enterprise',
  },
]

export async function Pricing() {
  return (
    <section id="precos" className="bg-bg-0">
      <div className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
        <div className="mb-16 text-center">
          <p className="eyebrow mb-3 text-fg-3">PREÇOS</p>
          <h2 className="font-sans text-h1 font-semibold tracking-tight text-fg-1 sm:text-[56px] sm:leading-tight">
            Trial 10 dias grátis.{' '}
            <span style={{ color: 'var(--accent)' }}>Cancele quando quiser</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-body text-fg-2">
            Validamos seu cartão para liberar o trial. No 11º dia, cobra automaticamente. Sem fidelidade.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5 lg:gap-3">
          {TIERS.map((tier) => (
            <div
              key={tier.slug}
              className="relative flex h-full flex-col transition-all duration-300"
              style={{
                background: tier.highlighted ? 'var(--bg-3)' : 'var(--bg-1)',
                border: tier.highlighted
                  ? '1px solid var(--accent)'
                  : '1px solid var(--border-1)',
                borderRadius: 'var(--r-lg)',
                boxShadow: tier.highlighted ? 'var(--shadow-glow)' : 'var(--shadow-card)',
                backdropFilter: 'var(--blur-glass)',
                WebkitBackdropFilter: 'var(--blur-glass)',
                transform: tier.highlighted ? 'translateY(-8px)' : undefined,
                zIndex: tier.highlighted ? 10 : 1,
              }}
            >
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span
                    className="rounded-pill px-4 py-1.5 text-micro font-bold tracking-wider"
                    style={{
                      background: 'var(--accent)',
                      color: 'var(--accent-ink)',
                    }}
                  >
                    {tier.badge}
                  </span>
                </div>
              )}

              <div className="px-5 pt-9 pb-5 text-center">
                <p className="eyebrow mb-3 text-fg-3">{tier.subtitle}</p>
                <div className="mb-2 flex items-baseline justify-center">
                  <span className="t-num text-h2 font-semibold text-fg-1">
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className="ml-1 text-small text-fg-3">{tier.period}</span>
                  )}
                </div>
                <p className="text-small leading-relaxed text-fg-2">{tier.description}</p>
              </div>

              <div className="flex-1 px-5">
                <p className="eyebrow mb-4 text-fg-3">INCLUSO</p>
                <ul className="space-y-3">
                  {tier.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-small text-fg-1">
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
                      <span className={f.included ? '' : 'text-fg-4'}>{f.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-5">
                <Link
                  href={tier.ctaHref}
                  className="block w-full rounded-pill py-3 text-center text-small font-medium transition-all"
                  style={
                    tier.highlighted
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
                  {tier.ctaLabel}
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Enterprise add-ons — transparência de precificação */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div
            className="overflow-hidden"
            style={{
              background: 'var(--bg-1)',
              border: '1px solid var(--border-1)',
              borderRadius: 'var(--r-lg)',
              backdropFilter: 'var(--blur-glass)',
              WebkitBackdropFilter: 'var(--blur-glass)',
            }}
          >
            <div
              className="px-6 py-4"
              style={{ borderBottom: '1px solid var(--border-1)' }}
            >
              <p className="eyebrow mb-1 text-fg-3">ENTERPRISE · ADICIONAIS</p>
              <h3 className="text-h3 font-semibold text-fg-1">
                Como compomos o preço do Enterprise
              </h3>
              <p className="mt-1 text-small text-fg-2">
                Base R$ 4.997/mês (até 50 operadores) + agregadores conforme uso e necessidade.
              </p>
            </div>
            <table className="w-full text-small">
              <tbody>
                {[
                  ['Volume operado acima de R$ 50M/mês', '+ 0,02% sobre excedente'],
                  ['Usuários adicionais (após 50)', '+ R$ 79 / usuário / mês'],
                  ['SSO / SAML + provisionamento SCIM', '+ R$ 497 / mês'],
                  ['SLA 99,9% + suporte 24/7 dedicado', '+ R$ 997 / mês'],
                  ['Workspace single-tenant (compliance)', '+ R$ 2.500 / mês'],
                  ['Integração ERP customizada (SAP / TOTVS / Senior)', 'R$ 15–50k + R$ 1.500/mês'],
                  ['Onboarding presencial + training', 'R$ 5–15k (one-time)'],
                ].map(([label, value], i, arr) => (
                  <tr
                    key={label}
                    style={
                      i < arr.length - 1
                        ? { borderBottom: '1px solid var(--border-1)' }
                        : undefined
                    }
                  >
                    <td className="px-6 py-3 text-fg-1">{label}</td>
                    <td className="px-6 py-3 text-right t-num text-fg-2">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div
              className="px-6 py-3 text-micro text-fg-3"
              style={{ borderTop: '1px solid var(--border-1)', background: 'var(--bg-2)' }}
            >
              Volume-based bidding garante alinhamento de valor — você só paga mais conforme cresce.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
