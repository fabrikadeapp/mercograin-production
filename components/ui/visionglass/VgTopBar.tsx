'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  Tag,
  Calculator,
  LineChart,
  Wallet,
  Sparkles,
  Search,
  ChevronDown,
  LogOut,
  Settings,
  TrendingUp,
  Store,
  ShoppingCart,
  Coins,
  BarChart3,
  Users,
  Package,
  ListChecks,
  Truck,
  Scale,
  Target,
  Shield,
  AlertTriangle,
  Receipt,
  CheckSquare,
  Leaf,
  Banknote,
  MessageCircle,
  MoreHorizontal,
} from 'lucide-react'
import { signOut } from 'next-auth/react'

interface Props {
  userName: string | null
  userEmail: string | null
  userRole: string | null
  workspaceName: string | null
}

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_PRIMARY: NavItem[] = [
  { href: '/bhgrain', label: 'BH Grain', icon: Sparkles },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contratos', label: 'Contratos', icon: FileText },
  { href: '/ofertas', label: 'Ofertas', icon: Tag },
  { href: '/calculadora', label: 'Calculadora', icon: Calculator },
  { href: '/hedge', label: 'Hedge', icon: LineChart },
  { href: '/financeiro', label: 'Financeiro', icon: Wallet },
]

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_MORE: NavGroup[] = [
  {
    label: 'Mesa & Mercado',
    items: [
      { href: '/cotacoes', label: 'Cotações', icon: TrendingUp },
      { href: '/futuros', label: 'Futuros', icon: LineChart },
      { href: '/classificados', label: 'Classificados', icon: Store },
    ],
  },
  {
    label: 'Cadastros',
    items: [
      { href: '/clientes', label: 'Clientes & CRM', icon: Users },
      { href: '/fornecedores', label: 'Fornecedores', icon: Package },
      { href: '/propostas', label: 'Propostas', icon: ListChecks },
    ],
  },
  {
    label: 'Operação',
    items: [
      { href: '/originacao', label: 'Originação', icon: Target },
      { href: '/logistica', label: 'Logística', icon: Truck },
      { href: '/operacao', label: 'Operação', icon: Scale },
      { href: '/boletos', label: 'Boletos', icon: Wallet },
    ],
  },
  {
    label: 'Risco & Compliance',
    items: [
      { href: '/risco', label: 'Risco', icon: AlertTriangle },
      { href: '/fiscal', label: 'Fiscal', icon: Receipt },
      { href: '/aprovacoes', label: 'Aprovações', icon: CheckSquare },
      { href: '/eudr', label: 'EUDR', icon: Leaf },
    ],
  },
  {
    label: 'Outros',
    items: [
      { href: '/fluxo-de-caixa', label: 'Fluxo de Caixa', icon: Coins },
      { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
      { href: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
    ],
  },
]

function initials(s: string | null): string {
  if (!s) return '·'
  const parts = s.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function VgTopBar({ userName, userEmail, userRole, workspaceName }: Props) {
  const pathname = usePathname() ?? ''
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-6 md:px-8 pt-4">
      <div
        className="mx-auto flex items-center gap-3 px-4 py-2.5"
        style={{
          maxWidth: '1400px',
          background: 'var(--vg-glass-dock)',
          border: '1px solid var(--vg-glass-dock-border)',
          borderRadius: 'var(--vg-radius-dock)',
          boxShadow: 'var(--vg-shadow-dock)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
        }}
      >
        {/* Brand + workspace */}
        <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
            style={{ background: 'var(--vg-accent-primary)', color: '#fff' }}
          >
            PHB
          </div>
          {workspaceName ? (
            <div className="hidden md:flex flex-col leading-tight">
              <span className="text-[10px] uppercase tracking-wider text-vg-fg-3">
                Workspace
              </span>
              <span className="text-sm font-semibold text-vg-fg truncate max-w-[140px]">
                {workspaceName}
              </span>
            </div>
          ) : null}
        </Link>

        {/* Nav primário */}
        <nav className="flex items-center gap-0.5 flex-1 justify-center">
          {NAV_PRIMARY.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-full text-[13px] font-medium transition-all"
                style={{
                  background: active ? 'var(--vg-glass-card-hover)' : 'transparent',
                  color: active ? 'var(--vg-fg-primary)' : 'var(--vg-fg-secondary)',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            )
          })}

          {/* "Mais" dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-full text-[13px] font-medium transition-all"
              style={{
                background: moreOpen ? 'var(--vg-glass-card-hover)' : 'transparent',
                color: moreOpen ? 'var(--vg-fg-primary)' : 'var(--vg-fg-secondary)',
              }}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Mais</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {moreOpen ? (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMoreOpen(false)}
                  aria-hidden
                />
                <div
                  className="absolute left-1/2 -translate-x-1/2 mt-2 w-[640px] z-50 overflow-hidden"
                  style={{
                    background: 'var(--vg-glass-dock)',
                    border: '1px solid var(--vg-glass-dock-border)',
                    borderRadius: 'var(--vg-radius-lg)',
                    boxShadow: 'var(--vg-shadow-dock)',
                    backdropFilter: 'blur(40px)',
                    WebkitBackdropFilter: 'blur(40px)',
                  }}
                >
                  <div className="grid grid-cols-2 gap-x-2 gap-y-3 p-4">
                    {NAV_MORE.map((group) => (
                      <div key={group.label}>
                        <div className="text-[10px] uppercase tracking-wider text-vg-fg-3 px-2 mb-1.5 font-semibold">
                          {group.label}
                        </div>
                        <div className="space-y-0.5">
                          {group.items.map(({ href, label, icon: Icon }) => {
                            const active = isActive(href)
                            return (
                              <Link
                                key={href}
                                href={href}
                                onClick={() => setMoreOpen(false)}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px]"
                                style={{
                                  background: active ? 'var(--vg-glass-card-hover)' : 'transparent',
                                  color: active ? 'var(--vg-fg-primary)' : 'var(--vg-fg-secondary)',
                                }}
                              >
                                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                                {label}
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </nav>

        {/* Busca */}
        <button
          className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] flex-shrink-0"
          style={{
            background: 'var(--vg-glass-pill-track)',
            color: 'var(--vg-fg-tertiary)',
            border: '1px solid var(--vg-glass-card-border)',
          }}
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Buscar…</span>
          <kbd
            className="hidden lg:inline ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono"
            style={{ background: 'var(--vg-glass-pill-thumb)', color: 'var(--vg-fg-secondary)' }}
          >
            ⌘K
          </kbd>
        </button>

        {/* User menu */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full transition-colors"
            style={{
              background: userMenuOpen ? 'var(--vg-glass-card-hover)' : 'transparent',
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{
                background: 'var(--vg-accent-primary-muted)',
                color: 'var(--vg-fg-primary)',
                border: '1px solid var(--vg-glass-card-border)',
              }}
            >
              {initials(userName)}
            </div>
            <ChevronDown className="w-3 h-3 text-vg-fg-3" />
          </button>

          {userMenuOpen ? (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUserMenuOpen(false)}
                aria-hidden
              />
              <div
                className="absolute right-0 mt-2 w-64 z-50 overflow-hidden"
                style={{
                  background: 'var(--vg-glass-dock)',
                  border: '1px solid var(--vg-glass-dock-border)',
                  borderRadius: 'var(--vg-radius-lg)',
                  boxShadow: 'var(--vg-shadow-dock)',
                  backdropFilter: 'blur(40px)',
                  WebkitBackdropFilter: 'blur(40px)',
                }}
              >
                <div className="px-4 py-3 border-b border-white/5">
                  <div className="text-sm font-semibold text-vg-fg truncate">
                    {userName ?? '—'}
                  </div>
                  <div className="text-xs text-vg-fg-3 truncate">{userEmail ?? '—'}</div>
                </div>
                <nav className="py-1">
                  <Link
                    href="/configuracoes"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-vg-fg hover:bg-white/5"
                  >
                    <Settings className="w-4 h-4" /> Configurações
                  </Link>
                  <Link
                    href="/configuracoes/ai"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-vg-fg hover:bg-white/5"
                  >
                    <Sparkles className="w-4 h-4" /> Agente AI
                  </Link>
                  {userRole === 'admin' ? (
                    <Link
                      href="/admin"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-vg-fg hover:bg-white/5"
                    >
                      <Shield className="w-4 h-4" /> Admin
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false)
                      signOut({ callbackUrl: '/' })
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-vg-destructive hover:bg-white/5"
                  >
                    <LogOut className="w-4 h-4" /> Sair
                  </button>
                </nav>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  )
}
