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

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contratos', label: 'Contratos', icon: FileText },
  { href: '/ofertas', label: 'Ofertas', icon: Tag },
  { href: '/calculadora', label: 'Calculadora', icon: Calculator },
  { href: '/hedge', label: 'Hedge', icon: LineChart },
  { href: '/financeiro', label: 'Financeiro', icon: Wallet },
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
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-6 md:px-8 pt-4">
      <div
        className="mx-auto flex items-center gap-4 px-4 py-2.5"
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
              <span className="text-sm font-semibold text-vg-fg truncate max-w-[160px]">
                {workspaceName}
              </span>
            </div>
          ) : null}
        </Link>

        {/* Nav primário */}
        <nav className="flex items-center gap-1 flex-1 justify-center">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-medium transition-all"
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
                      <LayoutDashboard className="w-4 h-4" /> Admin
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
