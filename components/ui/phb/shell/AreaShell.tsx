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
  /** Mapa de features habilitadas para o workspace. */
  enabledFeatures: Record<string, boolean>
  /** Áreas que o usuário tem permissão (vazio = todas). */
  permittedAreas?: Area[]
  /** Nome para exibir no canto. */
  userName?: string
  /** Nome do workspace (corretora). */
  workspaceName?: string
}

function Icon({ name, size = 16 }: { name: string; size?: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const C = (Icons as any)[name] as React.ComponentType<{ size?: number }> | undefined
  if (!C) return <Icons.Square size={size} />
  return <C size={size} />
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
  const accessibleAreas = !permittedAreas || permittedAreas.length === 0
    ? AREAS
    : AREAS.filter((a) => permittedAreas.includes(a))

  const sidebarItems: NavItem[] = visibleItems(NAV[currentArea] ?? [], enabledFeatures)
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="min-h-screen bg-bg-0 text-fg-1">
      {/* Topbar com 4 áreas */}
      <header className="sticky top-0 z-30 border-b border-border-1 bg-bg-0/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 md:px-8">
          <Brand />
          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {accessibleAreas.map((a) => {
              const active = a === currentArea
              const firstItem = visibleItems(NAV[a] ?? [], enabledFeatures)[0]
              const href = firstItem?.href ?? '/dashboard'
              return (
                <Link
                  key={a}
                  href={href}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-small transition-colors',
                    active
                      ? 'bg-bg-2 text-fg-1 font-semibold'
                      : 'text-fg-2 hover:text-fg-1 hover:bg-bg-2/60',
                  )}
                >
                  {AREA_LABEL[a]}
                </Link>
              )
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {workspaceName && (
              <span className="hidden text-mini text-fg-2 md:inline">{workspaceName}</span>
            )}
            {userName && (
              <span className="text-mini text-fg-1 font-medium">{userName}</span>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/auth/login' })}
              className="rounded-md p-1.5 text-fg-2 hover:bg-bg-2 hover:text-fg-1"
              title="Sair"
              aria-label="Sair"
            >
              <Icons.LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar contextual + conteúdo */}
      <div className="mx-auto flex max-w-[1440px] gap-6 px-4 md:px-8">
        <aside className="hidden w-56 shrink-0 py-6 md:block">
          <div className="text-mini uppercase tracking-[0.6px] text-fg-3 mb-2 px-2">
            {AREA_LABEL[currentArea]}
          </div>
          <nav className="space-y-0.5">
            {sidebarItems.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-small',
                  isActive(it.href)
                    ? 'bg-bg-2 text-fg-1 font-medium'
                    : 'text-fg-2 hover:text-fg-1 hover:bg-bg-2/60',
                )}
              >
                <Icon name={it.icon} />
                {it.label}
              </Link>
            ))}
            {sidebarItems.length === 0 && (
              <div className="px-2 py-3 text-mini text-fg-3">
                Nenhum recurso ativo nesta área. Fale com a BH Grain para liberar.
              </div>
            )}
          </nav>
        </aside>

        {/* Mobile: dropdown horizontal de áreas como tabs */}
        <div className="md:hidden -mx-4 overflow-x-auto px-4 py-2">
          <div className="flex gap-1">
            {accessibleAreas.map((a) => {
              const active = a === currentArea
              const firstItem = visibleItems(NAV[a] ?? [], enabledFeatures)[0]
              return (
                <Link
                  key={a}
                  href={firstItem?.href ?? '/dashboard'}
                  className={cn(
                    'rounded-full px-3 py-1 text-mini whitespace-nowrap',
                    active
                      ? 'bg-accent text-bg-0 font-semibold'
                      : 'bg-bg-2 text-fg-2',
                  )}
                >
                  {AREA_LABEL[a]}
                </Link>
              )
            })}
          </div>
        </div>

        <main className="min-w-0 flex-1 py-6 md:py-8">{children}</main>
      </div>
    </div>
  )
}
