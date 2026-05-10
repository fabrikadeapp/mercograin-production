import Link from 'next/link'
import { ArrowRight, FileText, ShieldCheck } from 'lucide-react'
import { LandingNav } from '@/app/_landing/LandingNav'
import { Footer } from '@/app/_landing/Footer'
import { Card } from '@/components/ui/phb'

export const metadata = {
  title: 'Legal — BH Grain',
  description: 'Termos de uso e política de privacidade do BH Grain.',
}

const ITEMS = [
  {
    href: '/legal/termos',
    title: 'Termos de uso',
    description: 'Condições contratuais para uso do BH Grain.',
    icon: FileText,
  },
  {
    href: '/legal/privacidade',
    title: 'Política de privacidade',
    description: 'Como coletamos, usamos e protegemos seus dados (LGPD).',
    icon: ShieldCheck,
  },
]

export default function LegalIndexPage() {
  return (
    <div className="min-h-screen bg-bg-0 text-fg-1">
      <LandingNav />

      <main>
        <section className="border-b border-border-1 bg-bg-0">
          <div className="mx-auto max-w-3xl px-4 py-20 md:px-8 md:py-28">
            <p className="eyebrow mb-3 text-fg-3">Legal</p>
            <h1 className="mb-10 font-sans text-display font-semibold tracking-tight text-fg-1">
              Documentos legais
            </h1>

            <div className="flex flex-col gap-4">
              {ITEMS.map((item) => (
                <Link key={item.href} href={item.href} className="group">
                  <Card className="flex items-center gap-5 p-6 transition-colors hover:border-border-2">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <h2 className="text-h3 font-semibold text-fg-1">{item.title}</h2>
                      <p className="text-small text-fg-2">{item.description}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-fg-3 transition-transform group-hover:translate-x-1 group-hover:text-accent" />
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
