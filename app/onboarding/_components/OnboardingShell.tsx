'use client'
import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface Props {
  step: number
  totalSteps: number
  ownerName: string
  children: React.ReactNode
}

const STEPS = [
  { id: 1, name: 'Empresa', sub: 'Dados cadastrais' },
  { id: 2, name: 'Equipe', sub: 'Convide membros' },
  { id: 3, name: 'Clientes', sub: 'Cadastro inicial' },
  { id: 4, name: 'Fornecedores', sub: 'Parceiros logísticos' },
  { id: 5, name: 'Templates', sub: 'Modelos de contrato' },
  { id: 6, name: 'Tour', sub: 'Próximos passos' },
]

export function OnboardingShell({ step, totalSteps, ownerName, children }: Props) {
  const firstName = ownerName.split(' ')[0] || 'parceiro'
  return (
    <div className="min-h-screen bg-bg-0 text-fg-1 grid grid-cols-1 lg:grid-cols-[360px_1fr]">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col justify-between bg-bg-1 border-r border-border-1 p-8">
        <div>
          <div className="flex items-center gap-2 mb-12">
            <div className="w-9 h-9 rounded-md bg-accent flex items-center justify-center font-bold text-bg-0">
              P
            </div>
            <div className="font-bold tracking-tight text-fg-1">BH Grain</div>
          </div>

          <div className="eyebrow text-fg-3 mb-3">CONFIGURAÇÃO INICIAL</div>
          <h2 className="text-h3 mb-1 text-fg-1">Olá, {firstName}.</h2>
          <p className="text-fg-3 text-sm mb-8">
            Vamos preparar seu workspace em 6 passos rápidos.
          </p>

          <div className="text-xs text-fg-4 mb-2">
            Passo {step} de {totalSteps}
          </div>
          <div className="h-1 w-full bg-bg-3 rounded-full mb-6 overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>

          <ul className="space-y-3">
            {STEPS.map((s) => {
              const done = s.id < step
              const current = s.id === step
              return (
                <li
                  key={s.id}
                  className={cn(
                    'flex items-start gap-3 p-2 rounded-md transition-colors',
                    current && 'bg-bg-2'
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-pos shrink-0 mt-0.5" />
                  ) : (
                    <Circle
                      className={cn(
                        'w-5 h-5 shrink-0 mt-0.5',
                        current ? 'text-accent' : 'text-fg-4'
                      )}
                    />
                  )}
                  <div>
                    <div
                      className={cn(
                        'text-sm font-medium',
                        done && 'text-fg-2',
                        current && 'text-fg-1',
                        !done && !current && 'text-fg-3'
                      )}
                    >
                      {s.name}
                    </div>
                    <div className="text-xs text-fg-4">{s.sub}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        <blockquote className="text-xs text-fg-4 italic border-l-2 border-border-1 pl-3">
          &ldquo;Inteligência de mercado e automação para quem move o agro
          brasileiro.&rdquo;
        </blockquote>
      </aside>

      {/* Content */}
      <main className="px-6 sm:px-10 lg:px-16 py-10 max-w-4xl w-full">
        {children}
      </main>
    </div>
  )
}
