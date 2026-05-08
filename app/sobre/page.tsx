import { TrendingUp, Zap, Shield } from 'lucide-react'
import { LandingNav } from '@/app/_landing/LandingNav'
import { Footer } from '@/app/_landing/Footer'
import { Card } from '@/components/ui/phb'

export const metadata = {
  title: 'Sobre — PHB Grain',
  description:
    'Mesa de operações para o agronegócio brasileiro. Construído com tecnologia bancária, adaptado à realidade do grão.',
}

const VALORES = [
  {
    icon: TrendingUp,
    title: 'Precisão',
    description:
      'Cotações oficiais CEPEA/ESALQ, fluxo de caixa preditivo, traçabilidade contábil. Os números têm que fechar.',
  },
  {
    icon: Zap,
    title: 'Velocidade',
    description:
      'Mesa rodando em tempo real. Alertas que chegam antes do problema. Decisão tomada em segundos, não em planilhas.',
  },
  {
    icon: Shield,
    title: 'Confiança',
    description:
      'Criptografia em repouso, backups diários, isolamento por workspace, auditoria completa. Sua trading não pode parar.',
  },
]

export default function SobrePage() {
  return (
    <div className="min-h-screen bg-bg-0 text-fg-1">
      <LandingNav />

      <main>
        {/* Hero */}
        <section className="border-b border-border-1 bg-bg-0">
          <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
            <div className="max-w-3xl">
              <p className="eyebrow mb-3 text-fg-3">Sobre</p>
              <h1 className="font-sans text-display font-semibold tracking-tight text-fg-1">
                Mesa de operações para o{' '}
                <span className="text-accent">agronegócio brasileiro</span>.
              </h1>
            </div>
          </div>
        </section>

        {/* Manifesto */}
        <section className="border-b border-border-1 bg-bg-0">
          <div className="mx-auto max-w-3xl px-4 py-24 md:px-8 md:py-28">
            <p className="eyebrow mb-3 text-fg-3">Manifesto</p>
            <div className="space-y-6 text-body leading-relaxed text-fg-2">
              <p>
                <span className="text-fg-1 font-medium">PHB Grain</span> nasceu da mesa
                de operações de uma trading real. Não é uma plataforma desenhada por
                consultores em PowerPoint — é o sistema que a gente queria ter quando
                fechava soja em Paranaguá às 4 da tarde de uma sexta-feira.
              </p>
              <p>
                Cansamos de ver tradings rodando em planilhas Excel descontroladas, sem
                visibilidade da margem real, sem alertas, sem integração com fontes
                oficiais. Operadores conferindo cotação no celular. Contratos perdidos
                em pastas no Drive. Fluxo de caixa que só fecha no fim do mês — quando
                já é tarde demais.
              </p>
              <p>
                Construímos o que faltava: uma mesa digital com CEPEA ao vivo, pipeline
                visual de contratos, fluxo de caixa preditivo e WhatsApp integrado.
                Para que sua trading rode com a mesma precisão de uma mesa Bloomberg —
                adaptada à realidade brasileira do grão.
              </p>
            </div>
          </div>
        </section>

        {/* Valores */}
        <section className="border-b border-border-1 bg-bg-0">
          <div className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-28">
            <div className="mb-12 max-w-2xl">
              <p className="eyebrow mb-3 text-fg-3">Valores</p>
              <h2 className="font-sans text-h1 font-semibold tracking-tight text-fg-1">
                Como pensamos o produto
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {VALORES.map((v) => (
                <Card key={v.title} className="flex flex-col gap-4 p-7">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/10 text-accent">
                    <v.icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-h3 font-semibold text-fg-1">{v.title}</h3>
                    <p className="text-small leading-relaxed text-fg-2">
                      {v.description}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Stack */}
        <section className="border-b border-border-1 bg-bg-0">
          <div className="mx-auto max-w-3xl px-4 py-24 md:px-8 md:py-28">
            <p className="eyebrow mb-3 text-fg-3">Stack</p>
            <h2 className="mb-5 font-sans text-h1 font-semibold tracking-tight text-fg-1">
              Construído com tecnologia bancária.
            </h2>
            <p className="text-body leading-relaxed text-fg-2">
              Postgres com replicação contínua. Stripe para pagamentos. Integração
              direta com CEPEA/ESALQ. Criptografia em repouso, backups diários,
              SSL/TLS em todo lugar. Isolamento de dados por workspace, auditoria
              imutável de cada alteração. A infra que sua trading merece — sem
              precisar contratar uma equipe de DevOps.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
