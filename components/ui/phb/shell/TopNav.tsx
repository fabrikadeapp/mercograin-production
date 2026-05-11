'use client'
import * as React from 'react'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import {
  LayoutDashboard,
  TrendingUp,
  Calculator,
  LineChart,
  ShoppingCart,
  Store,
  Users,
  Package,
  ListChecks,
  FileText,
  Truck,
  Scale,
  Target,
  Wallet,
  Coins,
  Banknote,
  Shield,
  AlertTriangle,
  Receipt,
  Leaf,
  CheckSquare,
  BarChart3,
  MessageCircle,
  WifiOff,
  Settings,
  LogOut,
  Sparkles,
} from 'lucide-react'
import { DropdownNavigation, type NavItem } from '@/components/ui/dropdown-navigation'

const NAV_ITEMS: NavItem[] = [
  {
    id: 1,
    label: 'Dashboard',
    link: '/dashboard',
  },
  {
    id: 2,
    label: 'Mesa',
    subMenus: [
      {
        title: 'Cotações & Análise',
        items: [
          { label: 'Cotações', description: 'CEPEA, BCB e CBOT ao vivo', icon: TrendingUp, href: '/cotacoes' },
          { label: 'Calculadora', description: 'Preço líquido ao produtor', icon: Calculator, href: '/calculadora' },
        ],
      },
      {
        title: 'Trading',
        items: [
          { label: 'Futuros', description: 'Book próprio B3 + CBOT', icon: LineChart, href: '/futuros' },
          { label: 'Ofertas', description: 'Marketplace de compra e venda', icon: ShoppingCart, href: '/ofertas' },
          { label: 'Classificados', description: 'Anúncios públicos de lotes', icon: Store, href: '/classificados' },
        ],
      },
    ],
  },
  {
    id: 3,
    label: 'Comercial',
    subMenus: [
      {
        title: 'CRM',
        items: [
          { label: 'Clientes & CRM', description: 'Cadastro com KYC e propriedades', icon: Users, href: '/clientes' },
          { label: 'Fornecedores', description: 'Indústrias e transportadoras', icon: Package, href: '/fornecedores' },
        ],
      },
      {
        title: 'Pipeline',
        items: [
          { label: 'Propostas', description: 'Cotação enviada e em negociação', icon: ListChecks, href: '/propostas' },
          { label: 'Contratos', description: 'Contratos ativos e em assinatura', icon: FileText, href: '/contratos' },
          { label: 'Templates', description: 'Personalize cláusulas e modelos da sua empresa', icon: FileText, href: '/contratos/templates' },
        ],
      },
    ],
  },
  {
    id: 4,
    label: 'Operação',
    subMenus: [
      {
        title: 'Logística',
        items: [
          { label: 'Logística', description: 'Ordens de carga e CT-e', icon: Truck, href: '/logistica' },
          { label: 'Operação física', description: 'Romaneios, balança e estoque', icon: Scale, href: '/operacao' },
        ],
      },
      {
        title: 'Originação',
        items: [
          { label: 'Originação', description: 'Fixação parcial, barter e adiantamentos', icon: Target, href: '/originacao' },
        ],
      },
    ],
  },
  {
    id: 5,
    label: 'Financeiro',
    subMenus: [
      {
        title: 'Cobrança',
        items: [
          { label: 'Boletos', description: 'Geração Braspag + retorno CNAB', icon: Wallet, href: '/boletos' },
          { label: 'Fluxo de Caixa', description: 'Recebíveis e pagáveis', icon: Coins, href: '/fluxo-de-caixa' },
        ],
      },
      {
        title: 'Gestão',
        items: [
          { label: 'Financeiro', description: 'Movimentos, centros de custo, comissões', icon: Banknote, href: '/financeiro' },
        ],
      },
    ],
  },
  {
    id: 6,
    label: 'Risco & Fiscal',
    subMenus: [
      {
        title: 'Risco',
        items: [
          { label: 'Hedge', description: 'Long/Short, NDF e exposição', icon: Shield, href: '/hedge' },
          { label: 'Risco', description: 'VaR, limites e breach alerts', icon: AlertTriangle, href: '/risco' },
        ],
      },
      {
        title: 'Compliance',
        items: [
          { label: 'Fiscal', description: 'NF-e, SPED, DARF e guias', icon: Receipt, href: '/fiscal' },
          { label: 'EUDR', description: 'Due Diligence Statement', icon: Leaf, href: '/eudr' },
          { label: 'Aprovações', description: 'Workflow multi-nível', icon: CheckSquare, href: '/aprovacoes' },
        ],
      },
    ],
  },
  {
    id: 7,
    label: 'Insights',
    subMenus: [
      {
        title: 'Análise',
        items: [
          { label: 'Relatórios', description: 'DRE, curva ABC, aging, C-Level', icon: BarChart3, href: '/relatorios' },
        ],
      },
      {
        title: 'Comunicação',
        items: [
          { label: 'WhatsApp', description: 'Inbox bot e comandos', icon: MessageCircle, href: '/whatsapp' },
        ],
      },
    ],
  },
]

function getInitials(name?: string | null): string {
  if (!name) return '·'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
      <div
        className="h-8 w-8 rounded-pill border border-border-2 bg-bg-2 flex items-center justify-center"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2c4 3 6 7 6 10a6 6 0 1 1-12 0c0-3 2-7 6-10z" />
          <path d="M12 6v12" opacity="0.6" />
        </svg>
      </div>
      <div className="text-body font-semibold leading-none">
        <span className="text-fg-1">BH</span>
        <span className="text-accent ml-1">Grain</span>
      </div>
    </Link>
  )
}

function WhatsAppIndicator() {
  const [state, setState] = React.useState<'open' | 'connecting' | 'close' | 'unknown' | 'loading'>('loading')

  React.useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const r = await fetch('/api/whatsapp/status', { cache: 'no-store' })
        if (!r.ok) {
          if (!cancelled) setState('unknown')
          return
        }
        const d = await r.json()
        if (!cancelled) setState(d.status ?? 'unknown')
      } catch {
        if (!cancelled) setState('unknown')
      }
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  if (state === 'loading') return null
  if (state === 'open') {
    return (
      <Link
        href="/whatsapp"
        className="inline-flex items-center justify-center h-7 w-7 rounded-pill text-micro font-bold"
        style={{ background: 'var(--pos)', color: 'var(--accent-ink)' }}
        title="WhatsApp conectado"
      >
        ✓
      </Link>
    )
  }
  return (
    <Link
      href="/whatsapp"
      className="inline-flex items-center justify-center h-7 w-7 rounded-pill"
      style={{ background: 'var(--bg-2)' }}
      title="WhatsApp desconectado"
    >
      <WifiOff className="h-3.5 w-3.5" style={{ color: 'var(--neg)' }} />
    </Link>
  )
}

function UserMenu() {
  const { data: session } = useSession()
  const [open, setOpen] = React.useState(false)
  const initials = getInitials(session?.user?.name)
  const name = session?.user?.name ?? 'Convidado'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-pill border border-border-1 bg-bg-2 hover:border-border-2 px-2 py-1.5 transition"
        aria-label="Menu do usuário"
      >
        <span className="h-7 w-7 rounded-pill bg-bg-3 border border-border-2 flex items-center justify-center text-fg-1 text-micro font-semibold">
          {initials}
        </span>
        <span className="hidden md:block text-small text-fg-1 max-w-[140px] truncate">{name}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 mt-2 w-56 rounded-lg border border-border-1 bg-bg-1 shadow-xl z-50 overflow-hidden"
          >
            <div className="px-3 py-3 border-b border-border-1">
              <p className="text-small font-medium text-fg-1 truncate">{name}</p>
              <p className="text-micro text-fg-3 truncate">{session?.user?.email}</p>
            </div>
            <Link
              href="/configuracoes/marca"
              className="flex items-center gap-2 px-3 py-2 text-small text-fg-1 hover:bg-bg-2 transition"
              onClick={() => setOpen(false)}
            >
              <Settings className="h-4 w-4" /> Configurações
            </Link>
            <Link
              href="/perfil/seguranca/2fa"
              className="flex items-center gap-2 px-3 py-2 text-small text-fg-1 hover:bg-bg-2 transition"
              onClick={() => setOpen(false)}
            >
              <Shield className="h-4 w-4" /> Segurança · 2FA
            </Link>
            <Link
              href="/admin"
              className="flex items-center gap-2 px-3 py-2 text-small text-fg-1 hover:bg-bg-2 transition"
              onClick={() => setOpen(false)}
            >
              <Sparkles className="h-4 w-4" /> Admin
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/login' })}
              className="w-full flex items-center gap-2 px-3 py-2 text-small text-neg hover:bg-bg-2 transition border-t border-border-1"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border-1 bg-bg-0/90 backdrop-blur-md">
      <div className="mx-auto max-w-[1440px] flex items-center px-4 md:px-6 py-2 gap-6">
        <Brand />
        <nav className="hidden md:flex items-center min-w-0">
          <DropdownNavigation navItems={NAV_ITEMS} />
        </nav>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <WhatsAppIndicator />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
