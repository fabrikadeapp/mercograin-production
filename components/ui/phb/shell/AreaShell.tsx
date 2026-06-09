'use client'
import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import * as Icons from 'lucide-react'
import { Brand } from './Brand'
import { AREAS, AREA_LABEL, routeToArea, type Area } from '@/lib/areas'
import { NAV, visibleItems, type NavItem } from '@/lib/areas/nav-catalog'
import { cn } from '@/lib/utils/cn'

export interface AreaShellProps {
  children: React.ReactNode
  enabledFeatures: Record<string, boolean>
  permittedAreas?: Area[]
  userName?: string
  workspaceName?: string
}

function Icon({ name, size = 16 }: { name: string; size?: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const C = (Icons as any)[name] as React.ComponentType<{ size?: number; className?: string }> | undefined
  if (!C) return <Icons.Square size={size} />
  return <C size={size} />
}

/** Áreas que dependem de uma feature para aparecer no topnav. */
const AREA_REQUIRES: Partial<Record<Area, string>> = {
  operacao: 'logistica',
  // mesa/financeiro/gestao são sempre visíveis (core)
}

function isAreaVisible(
  area: Area,
  enabledFeatures: Record<string, boolean>,
  itemCount: number,
): boolean {
  const req = AREA_REQUIRES[area]
  if (req && enabledFeatures[req] !== true) return false
  if (itemCount === 0) return false
  return true
}

export function AreaShell({
  children,
  enabledFeatures,
  permittedAreas,
  userName,
  workspaceName,
}: AreaShellProps) {
  const pathname = usePathname() || ''
  const currentArea = (routeToArea(pathname) ?? 'mesa') as Area
  const [openArea, setOpenArea] = React.useState<Area | null>(null)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const accessibleAreas = (!permittedAreas || permittedAreas.length === 0
    ? AREAS
    : AREAS.filter((a) => permittedAreas.includes(a))
  ).filter((a) =>
    isAreaVisible(a, enabledFeatures, visibleItems(NAV[a] ?? [], enabledFeatures).length),
  )

  function openWith(a: Area) {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpenArea(a)
  }
  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpenArea(null), 180)
  }

  return (
    <div className="min-h-screen bg-bg-0 text-fg-1">
      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b border-border-1 bg-bg-0/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-4 md:px-8">
          <Brand />

          {/* Desktop nav */}
          <nav className="hidden flex-1 items-center md:flex">
            {accessibleAreas.map((a) => {
              const items = visibleItems(NAV[a] ?? [], enabledFeatures)
              const isActive = a === currentArea
              const isOpen = openArea === a
              return (
                <div
                  key={a}
                  className="relative"
                  onMouseEnter={() => openWith(a)}
                  onMouseLeave={scheduleClose}
                >
                  <button
                    type="button"
                    onClick={() => setOpenArea(isOpen ? null : a)}
                    className={cn(
                      'inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-small transition-colors',
                      isActive
                        ? 'text-fg-1 font-semibold'
                        : 'text-fg-2 hover:text-fg-1',
                    )}
                    aria-expanded={isOpen}
                    aria-haspopup="menu"
                  >
                    {AREA_LABEL[a]}
                    <Icons.ChevronDown
                      size={14}
                      className={cn(
                        'transition-transform',
                        isOpen ? 'rotate-180' : '',
                      )}
                    />
                  </button>
                  {isOpen && items.length > 0 && (
                    <div
                      role="menu"
                      onMouseEnter={() => openWith(a)}
                      onMouseLeave={scheduleClose}
                      className="absolute left-0 top-full z-40 mt-1 w-[340px] rounded-md border border-border-1 bg-bg-1 p-2 shadow-lg"
                    >
                      <div className="px-2 pb-1 pt-1 text-mini uppercase tracking-[0.6px] text-fg-3">
                        {AREA_LABEL[a]}
                      </div>
                      <ul className="space-y-0.5">
                        {items.map((it) =>
                          it.children && it.children.length > 0 ? (
                            <li key={it.href} className="pt-1">
                              {/* Cabeçalho do grupo (também é atalho para a tela principal) */}
                              <Link
                                role="menuitem"
                                href={it.href}
                                onClick={() => setOpenArea(null)}
                                className="flex items-center gap-2 rounded-md px-2 py-1 text-mini font-semibold uppercase tracking-[0.4px] text-fg-2 transition-colors hover:text-fg-1"
                              >
                                <Icon name={it.icon} />
                                {it.label}
                              </Link>
                              <ul className="mt-0.5 space-y-0.5 border-l border-border-1 pl-2.5">
                                {it.children.map((sub) => (
                                  <li key={sub.href}>
                                    <Link
                                      role="menuitem"
                                      href={sub.href}
                                      onClick={() => setOpenArea(null)}
                                      className="flex items-center gap-2.5 rounded-md p-2 text-fg-1 transition-colors hover:bg-bg-2"
                                    >
                                      <span className="text-fg-3">
                                        <Icon name={sub.icon} />
                                      </span>
                                      <span className="text-small font-medium leading-tight">
                                        {sub.label}
                                      </span>
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </li>
                          ) : (
                            <li key={it.href}>
                              <Link
                                role="menuitem"
                                href={it.href}
                                onClick={() => setOpenArea(null)}
                                className="flex items-start gap-3 rounded-md p-2 text-fg-1 transition-colors hover:bg-bg-2"
                              >
                                <span className="mt-0.5 text-fg-2">
                                  <Icon name={it.icon} />
                                </span>
                                <div className="min-w-0">
                                  <div className="text-small font-medium leading-tight text-fg-1">
                                    {it.label}
                                  </div>
                                </div>
                              </Link>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {workspaceName && (
              <span className="hidden text-mini text-fg-2 md:inline">{workspaceName}</span>
            )}
            {userName && (
              <span className="hidden text-mini text-fg-1 font-medium md:inline">{userName}</span>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/auth/login' })}
              className="rounded-md p-1.5 text-fg-2 hover:bg-bg-2 hover:text-fg-1"
              title="Sair"
              aria-label="Sair"
            >
              <Icons.LogOut size={16} />
            </button>
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-1.5 text-fg-2 hover:bg-bg-2 hover:text-fg-1 md:hidden"
              aria-label="Menu"
            >
              <Icons.Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile sheet */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="ml-auto h-full w-[300px] overflow-y-auto bg-bg-1 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <Brand />
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 text-fg-2 hover:bg-bg-2"
                aria-label="Fechar"
              >
                <Icons.X size={18} />
              </button>
            </div>
            <nav className="space-y-4">
              {accessibleAreas.map((a) => {
                const items = visibleItems(NAV[a] ?? [], enabledFeatures)
                return (
                  <div key={a}>
                    <div className="mb-1 text-mini uppercase tracking-[0.6px] text-fg-3">
                      {AREA_LABEL[a]}
                    </div>
                    <ul className="space-y-0.5">
                      {items.map((it) => (
                        <li key={it.href}>
                          <Link
                            href={it.href}
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center gap-2 rounded-md p-2 text-small text-fg-1 hover:bg-bg-2"
                          >
                            <Icon name={it.icon} />
                            {it.label}
                          </Link>
                          {it.children && it.children.length > 0 && (
                            <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-border-1 pl-2">
                              {it.children.map((sub) => (
                                <li key={sub.href}>
                                  <Link
                                    href={sub.href}
                                    onClick={() => setMobileOpen(false)}
                                    className="flex items-center gap-2 rounded-md p-2 text-small text-fg-2 hover:bg-bg-2 hover:text-fg-1"
                                  >
                                    <Icon name={sub.icon} />
                                    {sub.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Conteúdo (sem sidebar) */}
      <main className="mx-auto min-w-0 max-w-[1440px] px-4 py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  )
}
