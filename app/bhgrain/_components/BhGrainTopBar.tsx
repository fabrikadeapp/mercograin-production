'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Plus, Bell, Sparkles, Shield, LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { ThemeToggle } from '@/components/ui/newdb'
import {
  AREAS,
  AREA_LABEL,
  AREA_ENTRY,
  AREA_SUBMENU,
  routeToArea,
  canAccessArea,
  type Area,
} from '@/lib/areas'

interface Props {
  userName: string | null
  workspaceName: string | null
  onOpenPrioridades: () => void
  userEmail?: string | null
  userRole?: string | null
  /** Role do user dentro do workspace (owner|admin|member|viewer). */
  workspaceRole?: string | null
  /** Áreas permitidas pelo CEO. owner/admin ignoram este array. */
  areasPermitidas?: string[] | null
}

export function BhGrainTopBar({
  userName,
  workspaceName,
  onOpenPrioridades,
  userEmail,
  userRole,
  workspaceRole,
  areasPermitidas,
}: Props) {
  const pathname = usePathname()
  const [inboxBadge, setInboxBadge] = useState<number>(0)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  const userCtx = {
    globalRole: userRole ?? null,
    workspaceRole: workspaceRole ?? null,
    areasPermitidas: areasPermitidas ?? null,
  }

  // Área ativa pela rota atual (default mesa quando não dá pra resolver).
  const currentArea: Area = (pathname ? routeToArea(pathname) : null) ?? 'mesa'

  // Apenas as áreas que este user pode ver.
  const visibleAreas = AREAS.filter((a) => canAccessArea(userCtx, a))

  // Sub-menu da área ativa, filtrado para itens que o user pode acessar.
  const submenu = canAccessArea(userCtx, currentArea)
    ? AREA_SUBMENU[currentArea]
    : []

  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetch('/api/inbox?limit=1')
        .then((r) => r.json())
        .then((j) => {
          if (cancelled) return
          setInboxBadge(j?.counts?.total ?? 0)
        })
        .catch(() => {})
    load()
    // 2 min é suficiente — o sino só mostra count agregado
    const id = setInterval(load, 120_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  // Fecha dropdowns no click outside
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const initials =
    (userName ?? 'AM')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || 'AM'

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        backdropFilter: 'blur(16px) saturate(140%)',
        WebkitBackdropFilter: 'blur(16px) saturate(140%)',
        background: 'var(--glass-strong)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Linha 1 — Brand · Áreas · Search · Ações · Avatar */}
      <nav
        className="mx-auto flex items-center gap-5 px-6 md:px-10 py-3"
        style={{ maxWidth: '1440px' }}
      >
        {/* Brand */}
        <Link href="/bhgrain" className="flex items-center gap-2.5 shrink-0">
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: 'linear-gradient(135deg, var(--accent) 0%, #8fd900 100%)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--accent-ink)',
              fontFamily: 'var(--f-mono)',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            B
          </span>
          <span
            className="text-[14px] font-semibold tracking-tight hidden sm:block"
            style={{ letterSpacing: '-0.01em' }}
          >
            BH Grain
          </span>
        </Link>

        {/* Abas das 4 áreas — só as que o user vê */}
        <ul className="flex items-center gap-1 ml-2" style={{ flex: 1, minWidth: 0 }}>
          {visibleAreas.map((area) => {
            const active = area === currentArea
            return (
              <li key={area}>
                <Link
                  href={AREA_ENTRY[area]}
                  className="relative whitespace-nowrap flex items-center gap-1.5 transition"
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--r-pill)',
                    fontSize: 13,
                    color: active ? 'var(--text)' : 'var(--text-mute)',
                    background: active ? 'var(--tint-4pct)' : 'transparent',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {AREA_LABEL[area]}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="flex items-center gap-2 shrink-0">
          {/* Sino — popover real com notificações */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              aria-label="Notificações"
              className="btn icon"
              title="Notificações"
            >
              <Bell className="w-3.5 h-3.5" />
              {inboxBadge > 0 && (
                <span
                  className="font-semibold rounded-full"
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    minWidth: 16,
                    height: 16,
                    padding: '0 4px',
                    fontSize: 9,
                    background: 'var(--accent)',
                    color: 'var(--accent-ink)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  {inboxBadge > 9 ? '9+' : inboxBadge}
                </span>
              )}
            </button>
            {notifOpen && <NotificacoesPopover onClose={() => setNotifOpen(false)} />}
          </div>

          {/* Botão Laura.IA (antiga Prioridades IA) — só em Mesa */}
          {currentArea === 'mesa' && (
            <button
              onClick={onOpenPrioridades}
              className="btn"
              title="Laura.IA — o que fazer agora"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Laura.IA</span>
            </button>
          )}

          {/* Atalho dinâmico: Nova proposta na Mesa, Lançar movimento no Financeiro */}
          {currentArea === 'mesa' && (
            <Link href="/propostas/nova" className="btn primary" style={{ textDecoration: 'none' }}>
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Nova proposta</span>
            </Link>
          )}
          {currentArea === 'financeiro' && (
            <Link
              href="/financeiro/movimentos/novo?tipo=receita"
              className="btn primary"
              style={{ textDecoration: 'none' }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Lançar movimento</span>
            </Link>
          )}
          {currentArea === 'gestao' && (
            <Link href="/gestao/equipe" className="btn" style={{ textDecoration: 'none' }}>
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Equipe</span>
            </Link>
          )}

          <ThemeToggle />

          {/* Avatar — só nome+email+workspace+Sair */}
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 transition"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
              title="Menu do usuário"
            >
              {initials}
            </button>
            {userMenuOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  minWidth: 240,
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  boxShadow: 'var(--sh-3)',
                  padding: 6,
                  zIndex: 50,
                }}
              >
                <div
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--border)',
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {userName ?? 'Usuário'}
                  </div>
                  {userEmail && (
                    <div className="truncate" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {userEmail}
                    </div>
                  )}
                  {workspaceName && (
                    <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 2 }}>
                      Workspace:{' '}
                      <strong style={{ color: 'var(--text-mute)' }}>{workspaceName}</strong>
                    </div>
                  )}
                </div>

                <Link
                  href="/perfil"
                  onClick={() => setUserMenuOpen(false)}
                  role="menuitem"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    fontSize: 13,
                    color: 'var(--text)',
                    borderRadius: 'var(--r-sm)',
                    textDecoration: 'none',
                  }}
                >
                  Meu perfil
                </Link>

                <Link
                  href="/assinatura"
                  onClick={() => setUserMenuOpen(false)}
                  role="menuitem"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    fontSize: 13,
                    color: 'var(--text)',
                    borderRadius: 'var(--r-sm)',
                    textDecoration: 'none',
                  }}
                >
                  Minha assinatura
                </Link>

                <div
                  style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }}
                />

                {userRole === 'admin' && (
                  <>
                    <Link
                      href="/admin"
                      onClick={() => setUserMenuOpen(false)}
                      role="menuitem"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        fontSize: 13,
                        color: 'var(--accent)',
                        borderRadius: 'var(--r-sm)',
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      Painel super-admin
                    </Link>
                    <div
                      style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }}
                    />
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false)
                    signOut({ callbackUrl: '/auth/login' })
                  }}
                  role="menuitem"
                  className="w-full text-left"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    fontSize: 13,
                    color: 'var(--danger)',
                    borderRadius: 'var(--r-sm)',
                    background: 'transparent',
                    border: 0,
                    cursor: 'pointer',
                  }}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sair do sistema
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Linha 2 — Sub-menu da área ativa */}
      {submenu.length > 0 && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-1)',
          }}
        >
          <ul
            className="mx-auto flex items-center gap-1 px-6 md:px-10 py-2 overflow-x-auto"
            style={{ maxWidth: '1440px' }}
          >
            {submenu.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== AREA_ENTRY[currentArea] &&
                  pathname?.startsWith(item.href + '/'))
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="relative whitespace-nowrap flex items-center gap-1.5 transition"
                    style={{
                      padding: '5px 11px',
                      borderRadius: 'var(--r-pill)',
                      fontSize: 12,
                      color: active ? 'var(--text)' : 'var(--text-mute)',
                      background: active ? 'var(--surface-2)' : 'transparent',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {item.label}
                    {item.href === '/bhgrain/inbox' && inboxBadge > 0 && (
                      <span
                        className="font-semibold rounded-full px-1.5 py-0.5"
                        style={{
                          fontSize: 10,
                          background: 'var(--accent)',
                          color: 'var(--accent-ink)',
                        }}
                      >
                        {inboxBadge}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

    </header>
  )
}

// ============================================================================
// NotificacoesPopover — agrega alertas reais (preços, propostas vencendo,
// silenciadas) em um popover ancorado ao sino.
// ============================================================================

interface NotifItem {
  id: string
  tipo: 'alerta_preco' | 'proposta_vencendo' | 'silenciada'
  title: string
  description?: string
  href?: string
  createdAt?: string
}

function NotificacoesPopover({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<NotifItem[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/bhgrain/notificacoes')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j) => {
        if (!cancelled) setItems(j?.items ?? [])
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 6,
        width: 360,
        maxHeight: 460,
        overflowY: 'auto',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--sh-3)',
        zIndex: 50,
      }}
    >
      <header
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div style={{ fontSize: 13, fontWeight: 600 }}>Notificações</div>
        <Link
          href="/admin/bhgrain/alertas"
          onClick={onClose}
          style={{ fontSize: 11, color: 'var(--text-dim)', textDecoration: 'none' }}
        >
          Configurar →
        </Link>
      </header>
      <div className="py-1">
        {loading && (
          <div style={{ padding: 16, fontSize: 12, color: 'var(--text-dim)' }}>
            Carregando…
          </div>
        )}
        {!loading && items && items.length === 0 && (
          <div
            style={{
              padding: '24px 16px',
              fontSize: 12,
              color: 'var(--text-dim)',
              textAlign: 'center',
            }}
          >
            Nenhuma notificação por enquanto.
          </div>
        )}
        {!loading &&
          items?.map((n) => {
            const Body = (
              <div
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border)',
                  cursor: n.href ? 'pointer' : 'default',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background:
                      n.tipo === 'alerta_preco'
                        ? 'var(--accent)'
                        : n.tipo === 'proposta_vencendo'
                          ? 'var(--warning)'
                          : 'var(--text-dim)',
                    marginTop: 6,
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>
                    {n.title}
                  </div>
                  {n.description && (
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-dim)',
                        marginTop: 2,
                        lineHeight: 1.35,
                      }}
                    >
                      {n.description}
                    </div>
                  )}
                </div>
              </div>
            )
            return n.href ? (
              <Link
                key={n.id}
                href={n.href}
                onClick={onClose}
                style={{ textDecoration: 'none', display: 'block' }}
              >
                {Body}
              </Link>
            ) : (
              <div key={n.id}>{Body}</div>
            )
          })}
      </div>
    </div>
  )
}
