import { db } from '@/lib/db'
import Link from 'next/link'
import { LandingNav } from '@/app/_landing/LandingNav'
import { Footer } from '@/app/_landing/Footer'
import { Card, Button } from '@/components/ui/phb'
import { AtivarWizard } from './AtivarWizard'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Ativar minha licença — BH Grain',
}

interface Props {
  params: { token: string }
}

export default async function AtivarPage({ params }: Props) {
  const license = await db.license.findUnique({
    where: { onboardingToken: params.token },
  })

  if (!license) {
    return (
      <ErrorState
        titulo="Link inválido"
        mensagem="Este link de ativação não existe ou já foi usado. Se você já criou sua conta, faça login normalmente."
        ctaLabel="Ir para login"
        ctaHref="/auth/login"
      />
    )
  }

  if (license.workspaceId || license.status === 'active') {
    return (
      <ErrorState
        titulo="Licença já ativada"
        mensagem={`A licença ${license.codigo} já foi configurada. Use o login normal para acessar.`}
        ctaLabel="Ir para login"
        ctaHref="/auth/login"
      />
    )
  }

  if (license.onboardingExpiresAt && license.onboardingExpiresAt < new Date()) {
    return (
      <ErrorState
        titulo="Link expirado"
        mensagem={`Seu link de ativação expirou. Entre em contato com o suporte informando o código ${license.codigo} para gerarmos um novo.`}
        ctaLabel="Falar com suporte"
        ctaHref="/contato"
      />
    )
  }

  const planRow = await db.plan.findUnique({ where: { slug: license.plano } })

  return (
    <div className="min-h-screen bg-bg-0 text-fg-1">
      <LandingNav />
      <main>
        <section className="border-b border-border-1 bg-bg-0">
          <div className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-16">
            <div className="mb-8">
              <p className="eyebrow mb-3 text-fg-3">Ativação da licença</p>
              <h1 className="font-sans text-h1 font-semibold tracking-tight text-fg-1">
                Configure sua conta{' '}
                <span className="text-accent">BH Grain</span>
              </h1>
              <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-border-1 bg-bg-1 px-3 py-2 text-small text-fg-2">
                <span className="text-fg-3">Licença</span>
                <span className="font-mono font-semibold text-accent">
                  {license.codigo}
                </span>
                <span className="text-fg-3">·</span>
                <span>{planRow?.name || license.plano}</span>
              </div>
            </div>

            <AtivarWizard
              token={params.token}
              email={license.email}
              nomeInicial={license.nomeComprador || ''}
            />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

function ErrorState({
  titulo,
  mensagem,
  ctaLabel,
  ctaHref,
}: {
  titulo: string
  mensagem: string
  ctaLabel: string
  ctaHref: string
}) {
  return (
    <div className="min-h-screen bg-bg-0 text-fg-1">
      <LandingNav />
      <main>
        <section className="border-b border-border-1 bg-bg-0">
          <div className="mx-auto max-w-xl px-4 py-20 md:px-8 md:py-28">
            <Card className="p-10 text-center">
              <h1 className="font-sans text-h2 font-semibold tracking-tight text-fg-1">
                {titulo}
              </h1>
              <p className="mt-4 text-body text-fg-2">{mensagem}</p>
              <div className="mt-6">
                <Link href={ctaHref}>
                  <Button variant="primary">{ctaLabel}</Button>
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
