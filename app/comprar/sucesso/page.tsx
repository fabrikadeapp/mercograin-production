import Link from 'next/link'
import { CheckCircle2, Mail } from 'lucide-react'
import { LandingNav } from '@/app/_landing/LandingNav'
import { Footer } from '@/app/_landing/Footer'
import { Card, Button } from '@/components/ui/phb'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Pagamento recebido — BH Grain',
}

export default function ComprarSucessoPage() {
  return (
    <div className="min-h-screen bg-bg-0 text-fg-1">
      <LandingNav />
      <main>
        <section className="border-b border-border-1 bg-bg-0">
          <div className="mx-auto max-w-2xl px-4 py-20 md:px-8 md:py-28">
            <Card className="p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 mb-6">
                <CheckCircle2 className="h-7 w-7 text-accent" />
              </div>
              <h1 className="font-sans text-h1 font-semibold tracking-tight text-fg-1">
                Pagamento recebido
              </h1>
              <p className="mt-4 text-body text-fg-2">
                Sua licença BH Grain está sendo criada. Em alguns segundos
                você receberá um e-mail com:
              </p>
              <ul className="mx-auto mt-6 max-w-sm space-y-3 text-left text-fg-2 text-small">
                <li className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  Código da sua licença (formato BHG-AAAA-XXXXXX)
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  Link mágico para criar sua senha e acessar
                </li>
              </ul>
              <p className="mt-8 text-small text-fg-3">
                Não recebeu? Verifique a caixa de spam. O e-mail leva até 2
                minutos para chegar.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link href="/">
                  <Button variant="ghost">Voltar à home</Button>
                </Link>
                <Link href="/contato">
                  <Button variant="secondary">Falar com suporte</Button>
                </Link>
              </div>
            </Card>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
