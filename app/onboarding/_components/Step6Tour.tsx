'use client'
import Link from 'next/link'
import { LayoutDashboard, LineChart, MessageSquare, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/phb'

interface Props {
  ownerName: string
  onComplete: () => void
  onBack: () => void
  completing: boolean
}

const ACTIONS = [
  {
    href: '/dashboard',
    icon: LayoutDashboard,
    title: 'Ver dashboard ao vivo',
    sub: 'Métricas, contratos, propostas e alertas em tempo real.',
  },
  {
    href: '/cotacoes',
    icon: LineChart,
    title: 'Acessar suas cotações',
    sub: 'Soja, milho e trigo CBOT + dólar PTAX integrados.',
  },
  {
    href: '/whatsapp',
    icon: MessageSquare,
    title: 'Configurar WhatsApp Bot',
    sub: 'Envie cotações e contratos direto pelo WhatsApp.',
  },
]

export function Step6Tour({ ownerName, onComplete, onBack, completing }: Props) {
  const firstName = ownerName.split(' ')[0] || 'parceiro'
  return (
    <div className="space-y-8">
      <div>
        <div className="eyebrow text-fg-3 mb-2">ÚLTIMO PASSO</div>
        <h1 className="text-h1 text-fg-1 mb-3 flex items-center gap-3">
          Tudo pronto, {firstName}
          <CheckCircle2 className="w-8 h-8 text-pos" />
        </h1>
        <p className="text-fg-3 text-base">
          Seu workspace está configurado. A partir de agora, você tem acesso ao
          painel completo do PHB Grain — cotações ao vivo, contratos, boletos,
          logística e muito mais.
        </p>
      </div>

      <div>
        <div className="eyebrow text-fg-3 mb-3">PRÓXIMAS AÇÕES</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="border border-border-1 rounded-card bg-bg-1 p-5 hover:border-accent transition-colors group"
            >
              <a.icon className="w-7 h-7 text-accent mb-3" />
              <div className="font-semibold text-fg-1 mb-1 flex items-center gap-2">
                {a.title}
                <ArrowRight className="w-4 h-4 text-fg-3 group-hover:text-accent group-hover:translate-x-0.5 transition" />
              </div>
              <div className="text-fg-3 text-sm">{a.sub}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="border border-accent/30 bg-accent/5 rounded-card p-6">
        <div className="text-fg-1 font-semibold mb-1">Pronto para começar?</div>
        <div className="text-fg-3 text-sm mb-4">
          Vamos te levar para o painel principal. Você pode editar tudo a qualquer
          momento em Configurações.
        </div>
        <Button
          type="button"
          size="lg"
          onClick={onComplete}
          loading={completing}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Concluir e ir para o painel
        </Button>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border-1">
        <Button type="button" variant="ghost" onClick={onBack}>
          Voltar
        </Button>
        <div className="text-xs text-fg-4">
          Você pode editar tudo a qualquer momento em Configurações.
        </div>
      </div>
    </div>
  )
}
