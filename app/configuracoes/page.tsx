import Link from 'next/link'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { Image as ImageIcon, Sparkles, LineChart } from 'lucide-react'

export const dynamic = 'force-dynamic'

const SECTIONS = [
  {
    href: '/configuracoes/marca',
    title: 'Marca & Logo',
    description: 'Logo da empresa exibida em PDFs (contratos, propostas, boletos).',
    icon: ImageIcon,
  },
  {
    href: '/configuracoes/ai',
    title: 'Agente AI',
    description:
      'Configure o modo (gerenciado ou BYOK), modelo OpenAI e chave própria para o agente AI.',
    icon: Sparkles,
  },
  {
    href: '/configuracoes/cotacoes',
    title: 'Commodities no dashboard',
    description:
      'Escolha quais futures aparecem no widget de cotações em tempo real do dashboard.',
    icon: LineChart,
  },
]

export default async function ConfiguracoesPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  return (
    <AppShell>
      <PageHeader
        eyebrow="Configurações"
        title="Configurações da workspace"
        subtitle="Personalize identidade visual e integrações para esta workspace."
        search={false}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        {SECTIONS.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-4 p-5 rounded-lg border border-border bg-surface-1 hover:border-accent hover:shadow-sm transition"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-md bg-accent-soft text-accent flex items-center justify-center group-hover:bg-accent-soft transition">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-gray-900 mb-1">{title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  )
}
