'use client'
import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  TrendingUp,
  FileText,
  ListChecks,
  Wallet,
  LineChart,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Sparkles,
  Store,
  Coins,
  Truck,
  Package,
  MessageCircle,
  WifiOff,
  CreditCard,
  Calculator,
  Scale,
} from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'
import { cn } from '@/lib/utils/cn'
import { Button } from '../primitives/Button'
import { PaletteSwitcher } from './PaletteSwitcher'

interface NavItem {
  href: string
  icon: typeof LayoutDashboard
  label: string
  badge?: string
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/cotacoes', icon: TrendingUp, label: 'Cotações' },
  { href: '/calculadora', icon: Calculator, label: 'Calculadora' },
  { href: '/contratos', icon: FileText, label: 'Contratos' },
  { href: '/futuros', icon: LineChart, label: 'Futuros' },
  { href: '/classificados', icon: Store, label: 'Classificados' },
  { href: '/fluxo-de-caixa', icon: Coins, label: 'Fluxo de Caixa' },
  { href: '/relatorios', icon: BarChart3, label: 'Relatórios' },
  { href: '/clientes', icon: Users, label: 'Clientes & CRM' },
  { href: '/fornecedores', icon: Package, label: 'Fornecedores' },
  { href: '/propostas', icon: ListChecks, label: 'Propostas' },
  { href: '/boletos', icon: Wallet, label: 'Boletos' },
  { href: '/logistica', icon: Truck, label: 'Logística' },
  { href: '/operacao', icon: Scale, label: 'Operação' },
  { href: '/whatsapp', icon: MessageCircle, label: 'WhatsApp' },
] as const

function getInitials(name?: string | null): string {
  if (!name) return '·'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function SidebarBrand() {
  return (
    <div className="px-5 pt-6 pb-4 space-y-2">
      <div className="flex items-center gap-3">
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
          <span className="text-fg-1">PHB</span>
          <span className="text-accent ml-1">Grain</span>
        </div>
      </div>
      <p className="eyebrow">Grain Intelligence</p>
    </div>
  )
}

function SidebarUser() {
  const { data: session } = useSession()
  const name = session?.user?.name ?? 'Convidado'
  const initials = getInitials(session?.user?.name)
  const role = session?.user ? 'Trader Sênior' : 'Sem sessão'

  return (
    <div className="mx-3 my-2 flex items-center gap-3 px-3 py-3 rounded-md bg-bg-2 border border-border-1">
      <div
        className="h-10 w-10 rounded-pill bg-bg-3 border border-border-2 flex items-center justify-center text-fg-1 text-small font-semibold shrink-0"
        aria-hidden="true"
      >
        {initials}
      </div>
      <div className="min-w-0 flex flex-col">
        <span className="text-fg-1 text-small font-medium truncate">{name}</span>
        <span className="text-fg-3 text-micro uppercase tracking-wider truncate">
          {role}
        </span>
      </div>
    </div>
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

  if (state === 'open') {
    return (
      <span
        className="inline-flex items-center justify-center h-5 w-5 rounded-pill text-micro font-bold"
        style={{ background: 'var(--pos)', color: 'var(--accent-ink)' }}
        aria-label="Conectado"
        title="WhatsApp conectado"
      >
        ✓
      </span>
    )
  }
  if (state === 'loading') return null
  return (
    <span
      className="inline-flex items-center justify-center h-5 w-5"
      title="WhatsApp desconectado"
      aria-label="Desconectado"
    >
      <WifiOff className="h-3.5 w-3.5" style={{ color: 'var(--neg)' }} />
    </span>
  )
}

function SidebarNav() {
  const pathname = usePathname() ?? '/'
  return (
    <nav className="px-3 mt-2 space-y-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive =
          pathname === item.href ||
          (item.href !== '/' && pathname.startsWith(`${item.href}/`))
        const isWhatsApp = item.href === '/whatsapp'
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn('nav-item', isActive && 'nav-item-active')}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {isWhatsApp ? <WhatsAppIndicator /> : item.badge ? (
              <span
                className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-pill text-micro font-semibold t-num"
                style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
              >
                {item.badge}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

function SidebarProCard() {
  return (
    <div className="mx-3 mb-3 bg-bg-2 border border-border-1 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-accent" />
        <span className="text-fg-1 text-small font-semibold">PHB Grain Pro</span>
      </div>
      <p className="text-fg-3 text-micro leading-snug">
        Cotações em tempo real, integração CEPEA + B3 e bot WhatsApp ilimitado.
      </p>
      <Button size="sm" fullWidth>
        Fazer upgrade
      </Button>
    </div>
  )
}

function SidebarFooter() {
  return (
    <div className="px-3 pb-3 space-y-1">
      <div className="flex items-center justify-between gap-2 px-2 mb-2">
        <span className="eyebrow">Paleta</span>
        <PaletteSwitcher className="scale-75 origin-right" />
      </div>
      <Link href="/assinatura" className="nav-item">
        <CreditCard className="h-4 w-4 shrink-0" />
        <span className="flex-1">Assinatura</span>
      </Link>
      <Link href="/configuracoes" className="nav-item">
        <Settings className="h-4 w-4 shrink-0" />
        <span className="flex-1">Configurações</span>
      </Link>
      <button
        type="button"
        onClick={() => signOut()}
        className="nav-item w-full text-left"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        <span className="flex-1">Sair</span>
      </button>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="sidebar hidden md:flex flex-col w-64 shrink-0 min-h-screen sticky top-0">
      <SidebarBrand />
      <SidebarUser />
      <SidebarNav />
      <div className="flex-1" />
      <SidebarProCard />
      <SidebarFooter />
    </aside>
  )
}
