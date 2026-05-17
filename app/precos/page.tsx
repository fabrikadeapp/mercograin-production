import Link from 'next/link'
import { Check } from 'lucide-react'
import { LandingNav } from '@/app/_landing/LandingNav'
import { Footer } from '@/app/_landing/Footer'
import { Pricing } from '@/app/_landing/Pricing'
import { Faq } from '@/app/_landing/Faq'
import { Card, Button } from '@/components/ui/phb'
import { loadActivePlans } from '@/lib/pricing/serialize'

// Planos podem mudar via admin — revalida a cada 10min mantendo cache de CDN/edge
export const revalidate = 600

export const metadata = {
  title: 'Preços — BH Grain',
  description:
    'Trial de 10 dias grátis. Cancele quando quiser. Planos editáveis em tempo real.',
}

function Cell({ included }: { included: boolean }) {
  if (included) {
    return <Check className="mx-auto h-4 w-4 text-pos" aria-label="Incluído" />
  }
  return (
    <span className="text-fg-3" aria-label="Não incluído">
      —
    </span>
  )
}

export default async function PrecosPage() {
  const plans = await loadActivePlans()

  // União dos labels (ordem: aparecem na ordem do 1º plano que define cada label,
  // novos labels de planos seguintes são apendados).
  const labelOrder: string[] = []
  const labelSet = new Set<string>()
  for (const p of plans) {
    for (const f of p.features) {
      if (!labelSet.has(f.label)) {
        labelSet.add(f.label)
        labelOrder.push(f.label)
      }
    }
  }
  const includedMap = new Map<string, Map<string, boolean>>()
  for (const p of plans) {
    const inner = new Map<string, boolean>()
    for (const f of p.features) {
      inner.set(f.label, f.included)
    }
    includedMap.set(p.id, inner)
  }

  const rows = labelOrder.map((label) => ({
    label,
    cells: plans.map((p) => includedMap.get(p.id)?.get(label) ?? false),
  }))

  // Grid template: 2fr (label) + 1fr per plan
  const gridTemplate = `2fr ${plans.map(() => '1fr').join(' ')}`

  // CTA section uses 1º plano "secondary", highlight como "primary", último
  // ghost. (Mantém visual igual ao layout antigo de 3 botões.)
  const cta = plans

  return (
    <div className="min-h-screen bg-bg-0 text-fg-1">
      <LandingNav />

      <main>
        {/* Hero */}
        <section className="border-b border-border-1 bg-bg-0">
          <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
            <div className="max-w-2xl">
              <p className="eyebrow mb-3 text-fg-3">Preços</p>
              <h1 className="font-sans text-display font-semibold tracking-tight text-fg-1">
                Trial de {plans[0]?.trialDays ?? 10} dias.{' '}
                <span className="text-accent">Cancele quando quiser.</span>
              </h1>
              <p className="mt-5 text-body text-fg-2">
                Sem fidelidade, sem multa, sem letra miúda. Validamos seu cartão para
                liberar o trial e cobramos automaticamente no 11º dia caso queira
                continuar.
              </p>
            </div>
          </div>
        </section>

        <Pricing />

        {/* Tabela comparativa */}
        {rows.length > 0 && plans.length > 0 ? (
          <section className="border-b border-border-1 bg-bg-0">
            <div className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-28">
              <div className="mb-10 max-w-2xl">
                <p className="eyebrow mb-3 text-fg-3">Comparativo</p>
                <h2 className="font-sans text-h1 font-semibold tracking-tight text-fg-1">
                  O que cada plano inclui
                </h2>
              </div>

              <Card className="overflow-x-auto p-0">
                <div className="min-w-[640px]">
                  {/* Header */}
                  <div
                    className="grid border-b border-border-1 bg-bg-1"
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    <div className="px-5 py-4 text-small font-medium text-fg-3">
                      Funcionalidade
                    </div>
                    {plans.map((p) => (
                      <div
                        key={p.id}
                        className={
                          'px-5 py-4 text-center text-small font-medium ' +
                          (p.highlight
                            ? 'text-accent ring-1 ring-inset ring-accent/40 font-semibold'
                            : 'text-fg-2')
                        }
                      >
                        {p.shortName}
                      </div>
                    ))}
                  </div>

                  {rows.map((row, i) => (
                    <div
                      key={row.label}
                      className={
                        'grid ' +
                        (i < rows.length - 1 ? 'border-b border-border-1' : '')
                      }
                      style={{ gridTemplateColumns: gridTemplate }}
                    >
                      <div className="px-5 py-4 text-small text-fg-1">
                        {row.label}
                      </div>
                      {row.cells.map((included, idx) => {
                        const isHighlight = plans[idx].highlight
                        return (
                          <div
                            key={plans[idx].id}
                            className={
                              'px-5 py-4 text-center ' +
                              (isHighlight
                                ? 'bg-accent/5 ring-1 ring-inset ring-accent/20'
                                : '')
                            }
                          >
                            <Cell included={included} />
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </section>
        ) : null}

        <Faq />

        {/* CTA final */}
        <section className="border-b border-border-1 bg-bg-0">
          <div className="mx-auto max-w-3xl px-4 py-24 md:px-8 md:py-28">
            <Card className="flex flex-col items-center gap-6 p-10 text-center">
              <div className="space-y-3">
                <h2 className="font-sans text-h1 font-semibold tracking-tight text-fg-1">
                  Comece seu trial agora
                </h2>
                <p className="text-body text-fg-2">
                  {plans[0]?.trialDays ?? 10} dias grátis. Cancele quando quiser. Sem fidelidade.
                </p>
              </div>
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                {cta.map((p, idx) => {
                  const variant: 'primary' | 'ghost' | 'secondary' = p.highlight
                    ? 'primary'
                    : idx === cta.length - 1
                    ? 'ghost'
                    : 'ghost'
                  const size = p.highlight ? 'lg' : 'md'
                  return (
                    <Link key={p.id} href={p.ctaHref}>
                      <Button variant={variant} size={size}>
                        {p.ctaLabel}
                      </Button>
                    </Link>
                  )
                })}
              </div>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
