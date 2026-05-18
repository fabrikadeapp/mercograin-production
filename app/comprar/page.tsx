import { LandingNav } from '@/app/_landing/LandingNav'
import { Footer } from '@/app/_landing/Footer'
import { loadActivePlans } from '@/lib/pricing/serialize'
import { ComprarForm } from './ComprarForm'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Compre sua licença — BH Grain',
  description:
    'Compre seu plano agora e configure a conta depois. Sem signup prévio.',
}

export default async function ComprarPage({
  searchParams,
}: {
  searchParams?: { plan?: string; status?: string }
}) {
  const plans = await loadActivePlans()
  const initialPlan = searchParams?.plan && plans.find((p) => p.slug === searchParams.plan)
    ? searchParams.plan
    : plans.find((p) => p.highlight)?.slug || plans[0]?.slug || ''

  return (
    <div className="min-h-screen bg-bg-0 text-fg-1">
      <LandingNav />

      <main>
        <section className="border-b border-border-1 bg-bg-0">
          <div className="mx-auto max-w-3xl px-4 py-16 md:px-8 md:py-20">
            <div className="mb-10">
              <p className="eyebrow mb-3 text-fg-3">Comprar agora</p>
              <h1 className="font-sans text-h1 font-semibold tracking-tight text-fg-1">
                Pague primeiro,{' '}
                <span className="text-accent">configure depois</span>
              </h1>
              <p className="mt-4 text-body text-fg-2">
                Sem cadastro prévio. Você paga, recebe um e-mail com o código
                da licença e cria seu acesso quando quiser.
              </p>
              {searchParams?.status === 'cancel' && (
                <div className="mt-4 rounded-md border border-warn/30 bg-warn/10 p-3 text-small text-warn">
                  Compra cancelada. Você pode tentar novamente abaixo.
                </div>
              )}
            </div>

            <ComprarForm plans={plans} initialPlan={initialPlan} />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
