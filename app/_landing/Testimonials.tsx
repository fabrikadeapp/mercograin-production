/**
 * Testimonials — seção de prova social da landing.
 *
 * COMO ATIVAR:
 * 1. Edite o array `TESTIMONIALS` abaixo. Substitua o objeto com `quote: '__PLACEHOLDER__'`
 *    por um depoimento real (preencha `quote`, `authorName`, `authorRole`).
 * 2. Opcional: suba a logo da corretora em `/public/landing/logo-<empresa>.svg`
 *    e referencie em `companyLogoUrl` (ex.: `/landing/logo-mercograin.svg`).
 * 3. Plug no `LandingPage.tsx` entre `<Pricing />` e `<Faq />`:
 *      import { Testimonials } from './Testimonials'
 *      <Testimonials />
 *
 * A seção se auto-oculta enquanto só houver placeholders — não precisa comentar/descomentar.
 */
import { Card } from '@/components/ui/phb/data/Card'
import { Quote } from 'lucide-react'

interface Testimonial {
  id: string
  quote: string
  authorName: string
  authorRole: string
  companyName: string
  companyLogoUrl?: string
  highlight?: boolean
}

const TESTIMONIALS: Testimonial[] = [
  // Placeholder — corretora piloto MercoGrain. Trocar por quote real quando disponível.
  {
    id: 'mercograin-placeholder',
    quote: '__PLACEHOLDER__',
    authorName: '',
    authorRole: '',
    companyName: 'MercoGrain',
  },
]

const visibleTestimonials = TESTIMONIALS.filter((t) => t.quote !== '__PLACEHOLDER__')

export function Testimonials() {
  if (visibleTestimonials.length === 0) {
    return null
  }
  return (
    <section className="border-b border-border-1 bg-bg-1">
      <div className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
        <div className="mb-14 max-w-2xl">
          <p className="eyebrow mb-3 text-fg-3">Quem usa</p>
          <h2 className="font-sans text-h1 font-semibold tracking-tight text-fg-1">
            Tradings que confiam no <span className="text-accent">PHB Grain</span>.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleTestimonials.map((t) => (
            <Card key={t.id} className="flex flex-col gap-4 p-6">
              <Quote className="h-6 w-6 text-accent" />
              <p className="text-body leading-relaxed text-fg-2">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-auto flex items-center gap-3 border-t border-border-1 pt-4">
                {t.companyLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.companyLogoUrl}
                    alt={t.companyName}
                    className="h-10 w-10 rounded object-contain"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-bg-2 text-small font-bold text-fg-1">
                    {t.companyName.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-small font-medium text-fg-1">
                    {t.authorName}
                  </p>
                  <p className="truncate text-micro text-fg-3">
                    {t.authorRole} · {t.companyName}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
