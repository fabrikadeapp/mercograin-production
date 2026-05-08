import { Mail, MessageCircle, MapPin, Clock } from 'lucide-react'
import { LandingNav } from '@/app/_landing/LandingNav'
import { Footer } from '@/app/_landing/Footer'
import { Card } from '@/components/ui/phb'
import { ContatoForm } from './ContatoForm'

export const metadata = {
  title: 'Contato — PHB Grain',
  description: 'Fale com a gente. Email, WhatsApp ou formulário direto.',
}

export default function ContatoPage() {
  return (
    <div className="min-h-screen bg-bg-0 text-fg-1">
      <LandingNav />

      <main>
        {/* Hero */}
        <section className="border-b border-border-1 bg-bg-0">
          <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
            <div className="max-w-2xl">
              <p className="eyebrow mb-3 text-fg-3">Contato</p>
              <h1 className="font-sans text-display font-semibold tracking-tight text-fg-1">
                Fale com a gente.
              </h1>
              <p className="mt-5 text-body text-fg-2">
                Dúvida sobre planos, demonstração, parceria ou suporte. Respondemos em
                até 1 dia útil.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-border-1 bg-bg-0">
          <div className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-28">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
              <Card className="p-7 md:p-9">
                <div className="mb-6 space-y-1">
                  <h2 className="text-h2 font-semibold text-fg-1">Envie uma mensagem</h2>
                  <p className="text-small text-fg-3">
                    Preencha o formulário e retornamos no email informado.
                  </p>
                </div>
                <ContatoForm />
              </Card>

              <Card className="flex flex-col gap-6 p-7 md:p-9">
                <div className="space-y-1">
                  <h2 className="text-h2 font-semibold text-fg-1">Outros canais</h2>
                  <p className="text-small text-fg-3">
                    Prefere falar direto? Estamos por aqui.
                  </p>
                </div>

                <ul className="flex flex-col gap-5">
                  <ContactRow
                    icon={<Mail className="h-4 w-4" />}
                    label="Email"
                    value="contato@phbgrain.com.br"
                    href="mailto:contato@phbgrain.com.br"
                  />
                  <ContactRow
                    icon={<MessageCircle className="h-4 w-4" />}
                    label="WhatsApp"
                    value="+55 (11) 90000-0000"
                    href="https://wa.me/5511900000000"
                  />
                  <ContactRow
                    icon={<MapPin className="h-4 w-4" />}
                    label="Endereço"
                    value="Av. Paulista, 1000 — São Paulo / SP"
                  />
                  <ContactRow
                    icon={<Clock className="h-4 w-4" />}
                    label="Horário"
                    value="Segunda a sexta, 9h às 18h"
                  />
                </ul>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

function ContactRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode
  label: string
  value: string
  href?: string
}) {
  const content = (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
        {icon}
      </div>
      <div className="space-y-0.5">
        <p className="text-micro uppercase tracking-wider text-fg-3">{label}</p>
        <p className="text-small text-fg-1">{value}</p>
      </div>
    </div>
  )

  if (href) {
    return (
      <li>
        <a
          href={href}
          className="block rounded-md transition-colors hover:bg-bg-1"
          target={href.startsWith('http') ? '_blank' : undefined}
          rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
        >
          {content}
        </a>
      </li>
    )
  }
  return <li>{content}</li>
}
