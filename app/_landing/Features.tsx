import { Card } from '@/components/ui/phb'
import { FEATURES } from './data'

export function Features() {
  return (
    <section id="recursos" className="border-b border-border-1 bg-bg-0">
      <div className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
        <div className="mb-14 max-w-2xl">
          <p className="eyebrow mb-3 text-fg-3">Recursos</p>
          <h2 className="font-sans text-h1 font-semibold tracking-tight text-fg-1">
            Tudo que sua trading precisa,{' '}
            <span className="text-accent">sem trocar de aba</span>.
          </h2>
          <p className="mt-4 text-body text-fg-2">
            Seis pilares construídos para a operação real de uma mesa de grãos.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <Card
              key={title}
              className="group flex flex-col gap-4 p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-2 hover:shadow-card"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border-1 bg-bg-3 text-accent">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-h3 font-semibold text-fg-1">{title}</h3>
              <p className="text-body text-fg-2">{description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
