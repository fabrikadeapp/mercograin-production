'use client'
import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  TrendingUp,
  Megaphone,
  Activity,
  Server,
  ArrowLeft,
  LogOut,
  ShieldAlert,
  Tags,
  LineChart,
  HardDriveDownload,
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils/cn'

interface NavItem {
  href: string
  icon: typeof LayoutDashboard
  label: string
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: '/admin', icon: LayoutDashboard, label: 'Overview' },
  { href: '/admin/metricas', icon: LineChart, label: 'Métricas' },
  { href: '/admin/usuarios', icon: Users, label: 'Usuários' },
  { href: '/admin/assinaturas', icon: CreditCard, label: 'Assinaturas' },
  { href: '/admin/pricing', icon: Tags, label: 'Pricing CMS' },
  { href: '/admin/financeiro', icon: TrendingUp, label: 'Financeiro' },
  {
    href: '/admin/conteudo/classificados',
    icon: Megaphone,
    label: 'Conteúdo',
  },
  {
    href: '/admin/operacional/cotacoes',
    icon: Activity,
    label: 'Operacional',
  },
  { href: '/admin/cotacoes', icon: Activity, label: 'Fontes cotação' },
  { href: '/admin/design', icon: LineChart, label: 'Tema de design' },
  { href: '/admin/infra', icon: Server, label: 'Infraestrutura' },
  { href: '/admin/backups', icon: HardDriveDownload, label: 'Backups' },
] as const

function getInitials(name?: string | null): string {
  if (!name) return '·'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  // Conteúdo e Operacional têm subrotas — comparamos prefixo
  return pathname === href || pathname.startsWith(href + '/')
}

// Pra "Conteúdo" e "Operacional" o item ativo é qualquer subrota deles
function navIsActive(pathname: string, href: string): boolean {
  if (href.startsWith('/admin/conteudo')) {
    return pathname.startsWith('/admin/conteudo')
  }
  if (href.startsWith('/admin/operacional')) {
    return pathname.startsWith('/admin/operacional')
  }
  return isActive(pathname, href)
}

export function AdminSidebar({
  user,
}: {
  user: { nome: string; email: string }
}) {
  const pathname = usePathname() ?? '/admin'
  const initials = getInitials(user.nome)

  return (
    <aside
      className="hidden md:flex flex-col w-64 shrink-0 min-h-screen sticky top-0 sidebar"
      style={{
        borderRight: '1px solid var(--border-1)',
        boxShadow: 'inset 2px 0 0 0 color-mix(in srgb, var(--neg) 40%, transparent)',
      }}
    >
      {/* Brand */}
      <div className="px-5 pt-6 pb-4 space-y-2">
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded-pill border flex items-center justify-center"
            style={{
              borderColor: 'var(--border-2)',
              background:
                'color-mix(in srgb, var(--neg) 12%, var(--bg-2))',
            }}
            aria-hidden="true"
          >
            <ShieldAlert className="h-4 w-4" style={{ color: 'var(--neg)' }} />
          </div>
          <div className="text-body font-semibold leading-none">
            <span className="text-fg-1">BH</span>
            <span className="text-accent ml-1">Grain</span>
          </div>
          <span
            className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-pill text-micro font-bold uppercase tracking-wider"
            style={{
              background: 'var(--neg)',
              color: 'var(--accent-ink)',
            }}
          >
            Admin
          </span>
        </div>
        <p className="eyebrow">Painel SuperAdmin</p>
      </div>

      {/* Perfil */}
      <div className="mx-3 my-2 flex items-center gap-3 px-3 py-3 rounded-md bg-bg-2 border border-border-1">
        <div
          className="h-10 w-10 rounded-pill bg-bg-3 border border-border-2 flex items-center justify-center text-fg-1 text-small font-semibold shrink-0"
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="min-w-0 flex flex-col">
          <span className="text-fg-1 text-small font-medium truncate">
            {user.nome}
          </span>
          <span className="text-fg-3 text-micro uppercase tracking-wider truncate">
            SuperAdmin
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-3 mt-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = navIsActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn('nav-item', active && 'nav-item-active')}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="flex-1" />

      {/* Footer */}
      <div className="px-3 pb-4 space-y-1 mt-4">
        <Link href="/dashboard" className="nav-item">
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="flex-1">Voltar ao app trader</span>
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
    </aside>
  )
}
