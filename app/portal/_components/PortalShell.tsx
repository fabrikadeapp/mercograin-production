'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  FileText,
  Wallet,
  Folder,
  MessageSquare,
  User,
  LineChart,
  Menu,
  LogOut,
  Sprout,
} from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

interface PortalShellProps {
  theme: 'light' | 'dark'
  slug: string
  workspaceNome: string
  clienteNome: string
  children: React.ReactNode
}

export function PortalShell({
  theme,
  slug,
  workspaceNome,
  clienteNome,
  children,
}: PortalShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const base = `/portal/${slug}`
  const nav = [
    { href: base, label: 'Início', icon: Home, exact: true },
    { href: `${base}/solicitar-cotacao`, label: 'Solicitar cotação', icon: Sprout },
    { href: `${base}/propostas`, label: 'Propostas', icon: FileText },
    { href: `${base}/contratos`, label: 'Contratos', icon: FileText },
    { href: `${base}/recebiveis`, label: 'Boletos', icon: Wallet },
    { href: `${base}/documentos`, label: 'Documentos', icon: Folder },
    { href: `${base}/chat`, label: 'Falar com corretora', icon: MessageSquare },
    { href: `${base}/perfil`, label: 'Meu perfil', icon: User },
  ]

  return (
    <div className={'portal-root portal-shell' + (menuOpen ? ' menu-open' : '')}>
      <aside className="portal-sidebar">
        <div className="brand">{workspaceNome}</div>
        {nav.map((n) => {
          const Ico = n.icon
          const active = n.exact ? pathname === n.href : pathname?.startsWith(n.href)
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setMenuOpen(false)}
              className={'nav-link' + (active ? ' active' : '')}
            >
              <Ico size={16} /> {n.label}
            </Link>
          )
        })}
        <div className="sb-footer">
          <form action="/api/portal/logout" method="post">
            <button type="submit" title="Sair">
              <LogOut size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              Sair
            </button>
          </form>
        </div>
      </aside>
      <div className="portal-main">
        <div className="portal-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="menu-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
            >
              <Menu size={18} />
            </button>
            <div className="titles">
              <strong>{clienteNome}</strong>
              <span>{workspaceNome}</span>
            </div>
          </div>
          <div className="top-actions">
            <ThemeToggle initial={theme} />
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
