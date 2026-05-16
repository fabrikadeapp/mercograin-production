import Link from 'next/link'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell, PageHeader } from '@/components/ui/phb'
import {
  Building2,
  Image as ImageIcon,
  Sparkles,
  LineChart,
  Plug,
  Workflow,
  Receipt,
  TrendingUp,
  Users,
  CreditCard,
  Wheat,
  Shield,
  FileText,
  Settings as SettingsIcon,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Section {
  href: string
  title: string
  description: string
  icon: typeof Building2
  badge?: string
  external?: boolean
}

interface SectionGroup {
  label: string
  description: string
  items: Section[]
}

const GROUPS: SectionGroup[] = [
  {
    label: 'Empresa & Identidade',
    description: 'Dados cadastrais, marca e identidade visual.',
    items: [
      {
        href: '/configuracoes/empresa',
        title: 'Dados da empresa',
        description: 'CNPJ, razão social, endereço, contato, contas bancárias.',
        icon: Building2,
      },
      {
        href: '/configuracoes/marca',
        title: 'Marca & Logo',
        description: 'Logo exibida em PDFs (contratos, propostas, boletos).',
        icon: ImageIcon,
      },
    ],
  },
  {
    label: 'Financeiro & Administrativo',
    description: 'Contas, centros de custo, regras fiscais.',
    items: [
      {
        href: '/financeiro/centros-custo',
        title: 'Centros de custo',
        description: 'Hierarquia para apuração gerencial (DRE, Curva ABC).',
        icon: Receipt,
      },
      {
        href: '/financeiro',
        title: 'Dashboard financeiro',
        description: 'KPIs, lançamentos, conciliação OFX, DRE.',
        icon: TrendingUp,
      },
      {
        href: '/fornecedores',
        title: 'Fornecedores',
        description: 'Cadastro de fornecedores (insumos, serviços, fretes).',
        icon: Users,
      },
    ],
  },
  {
    label: 'Comercial & Operação',
    description: 'Regras de proposta, margem, fluxo de trabalho.',
    items: [
      {
        href: '/configuracoes/fluxo-trabalho',
        title: 'Fluxo de trabalho',
        description: 'Margens por commodity, limites de aprovação, regras.',
        icon: Workflow,
      },
      {
        href: '/configuracoes/cotacoes',
        title: 'Commodities no dashboard',
        description: 'Quais futures aparecem no widget de cotações ao vivo.',
        icon: LineChart,
      },
      {
        href: '/configuracoes/ai',
        title: 'Agente IA',
        description: 'Modo gerenciado ou BYOK, modelo e chave OpenAI.',
        icon: Sparkles,
      },
    ],
  },
  {
    label: 'Integrações',
    description: 'Canais de comunicação e provedores externos.',
    items: [
      {
        href: '/configuracoes/integracoes',
        title: 'E-mail, WhatsApp, Instagram',
        description: 'Conecte suas contas para receber mensagens no Inbox unificado.',
        icon: Plug,
      },
    ],
  },
  {
    label: 'Conta & Segurança',
    description: 'Acesso, segurança e plano contratado.',
    items: [
      {
        href: '/assinatura',
        title: 'Minha assinatura',
        description: 'Plano, faturamento, próximas cobranças.',
        icon: CreditCard,
      },
      {
        href: '/profile',
        title: 'Meu perfil',
        description: 'Nome, email, 2FA, alterar senha.',
        icon: Shield,
      },
    ],
  },
]

export default async function ConfiguracoesPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  return (
    <AppShell>
      <PageHeader
        eyebrow="Configurações · Workspace"
        title="Central administrativa"
        subtitle="Dados cadastrais, financeiros, integrações e regras de operação."
        search={false}
      />

      <div className="space-y-6">
        {GROUPS.map((group) => (
          <section key={group.label}>
            <div className="mb-3">
              <h2
                className="font-semibold"
                style={{
                  fontSize: 14,
                  color: 'var(--text)',
                  letterSpacing: '-0.005em',
                }}
              >
                {group.label}
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-mute)', marginTop: 2 }}>
                {group.description}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: 16,
                      borderRadius: 'var(--r-md)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-1)',
                      textDecoration: 'none',
                      color: 'var(--text)',
                      transition: '120ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)'
                      e.currentTarget.style.background = 'var(--surface-2)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)'
                      e.currentTarget.style.background = 'var(--surface-1)'
                    }}
                  >
                    <div
                      style={{
                        flexShrink: 0,
                        width: 38,
                        height: 38,
                        borderRadius: 'var(--r-sm)',
                        background: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className="flex items-center gap-2"
                        style={{ marginBottom: 3 }}
                      >
                        <h3
                          className="font-semibold"
                          style={{ fontSize: 13, color: 'var(--text)' }}
                        >
                          {item.title}
                        </h3>
                        {item.badge && (
                          <span
                            className="eyebrow"
                            style={{
                              fontSize: 9,
                              padding: '1px 6px',
                              borderRadius: 999,
                              background: 'var(--accent-soft)',
                              color: 'var(--accent)',
                              border: '1px solid rgba(200,240,81,0.25)',
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p
                        style={{
                          fontSize: 11,
                          color: 'var(--text-mute)',
                          lineHeight: 1.5,
                        }}
                      >
                        {item.description}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  )
}
