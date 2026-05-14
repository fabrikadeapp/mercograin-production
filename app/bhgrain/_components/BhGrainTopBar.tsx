'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Search, Plus, Sparkles } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/newdb'

interface Props {
  userName: string | null
  workspaceName: string | null
  onOpenPrioridades: () => void
}

const MENU = [
  { href: '/bhgrain', label: 'Dashboard' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/bhgrain/inbox', label: 'Inbox', badgeKey: 'inbox' as const },
  { href: '/precos', label: 'Preços' },
  { href: '/propostas', label: 'Propostas' },
  { href: '/financeiro', label: 'Financeiro' },
]

export function BhGrainTopBar({ userName, workspaceName, onOpenPrioridades }: Props) {
  const pathname = usePathname()
  const [inboxBadge, setInboxBadge] = useState<number>(0)
  const [searchOpen, setSearchOpen] = useState(false)

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
    const id = setInterval(load, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
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
      <nav
        className="mx-auto flex items-center gap-7 px-6 md:px-14 py-3.5"
        style={{ maxWidth: '1440px' }}
      >
        {/* Brand mark NewDB — lime "B" mono */}
        <Link href="/bhgrain" className="brand flex items-center gap-2.5 shrink-0">
          <span
            className="brand-mark"
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
          <span className="text-[14px] font-semibold tracking-tight hidden sm:block" style={{ letterSpacing: '-0.01em' }}>
            BH Grain
          </span>
        </Link>

        {/* Menu — usa estilo .topnav nav a do newdb.css (pílulas) */}
        <ul className="flex items-center gap-1 ml-2 overflow-x-auto" style={{ flex: 1 }}>
          {MENU.map((m) => {
            const active = pathname === m.href || (m.href === '/bhgrain' && pathname?.startsWith('/bhgrain'))
            return (
              <li key={m.href}>
                <Link
                  href={m.href}
                  className="relative whitespace-nowrap flex items-center gap-1.5"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--r-pill)',
                    fontSize: 13,
                    color: active ? 'var(--text)' : 'var(--text-mute)',
                    background: active ? 'var(--tint-4pct)' : 'transparent',
                    transition: '120ms ease',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {m.label}
                  {m.badgeKey === 'inbox' && inboxBadge > 0 && (
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

        {/* Search ⌘K + ações à direita */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden md:flex items-center gap-2 transition"
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--r-pill)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text-dim)',
              fontSize: 13,
              minWidth: 320,
            }}
          >
            <Search className="w-3.5 h-3.5" />
            <span style={{ flex: 1, textAlign: 'left' }}>Buscar clientes, propostas, mensagens…</span>
            <span className="kbd">⌘K</span>
          </button>

          <ThemeToggle />

          <button onClick={onOpenPrioridades} className="btn" title="O que fazer agora">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Prioridades IA</span>
          </button>

          <Link href="/propostas/nova" className="btn primary" style={{ textDecoration: 'none' }}>
            <Plus className="w-3.5 h-3.5" />
            Nova proposta
          </Link>

          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
            style={{
              background: 'var(--vg-glass-card-hover, rgba(255,255,255,0.08))',
              color: 'var(--vg-fg-primary)',
            }}
            title={userName ?? workspaceName ?? ''}
          >
            {initials}
          </div>
        </div>
      </nav>

      {/* Spotlight de busca simples */}
      {searchOpen && <SearchSpotlight onClose={() => setSearchOpen(false)} />}
    </header>
  )
}

interface BuscaResult {
  clientes: { id: string; nome: string; email: string | null; tipo: string }[]
  propostas: { id: string; numero: string; status: string; cliente: { nome: string } }[]
  contratos: { id: string; numero: string; statusAssinatura: string | null; cliente: { nome: string } }[]
  boletos: { id: string; numero: string; status: string }[]
}

function SearchSpotlight({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [data, setData] = useState<BuscaResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Debounce 250ms
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setData(null)
      return
    }
    setLoading(true)
    const t = setTimeout(() => {
      fetch(`/api/busca?q=${encodeURIComponent(term)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((j) => setData(j))
        .catch(() => setData(null))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const total =
    (data?.clientes.length ?? 0) +
    (data?.propostas.length ?? 0) +
    (data?.contratos.length ?? 0) +
    (data?.boletos.length ?? 0)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div
        className="relative w-full max-w-xl rounded-2xl p-3 max-h-[70vh] overflow-y-auto"
        style={{
          background: 'var(--vg-bg-primary, #0a0a0a)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-2 sticky top-0" style={{ background: 'var(--vg-bg-primary, #0a0a0a)' }}>
          <Search className="w-4 h-4 text-vg-fg-3" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar clientes, propostas, contratos, boletos..."
            className="flex-1 bg-transparent outline-none text-[14px] py-2 text-vg-fg-primary"
          />
          <kbd className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)' }}>ESC</kbd>
        </div>

        {q.trim().length < 2 ? (
          <div className="mt-2 px-2 text-[11px] text-vg-fg-3">Digite pelo menos 2 caracteres…</div>
        ) : loading ? (
          <div className="mt-3 px-2 text-[12px] text-vg-fg-3">Buscando…</div>
        ) : !data || total === 0 ? (
          <div className="mt-3 px-2 text-[12px] text-vg-fg-3">Nenhum resultado.</div>
        ) : (
          <div className="mt-2 space-y-3">
            {data.clientes.length > 0 && (
              <SearchGroup title="Clientes" count={data.clientes.length}>
                {data.clientes.map((c) => (
                  <Link
                    key={c.id}
                    href={`/clientes/${c.id}`}
                    onClick={onClose}
                    className="block px-2 py-1.5 rounded text-[12px] hover:bg-white/5"
                  >
                    <div className="font-medium">{c.nome}</div>
                    <div className="text-[11px] text-vg-fg-3">{c.email ?? '—'} · {c.tipo}</div>
                  </Link>
                ))}
              </SearchGroup>
            )}
            {data.propostas.length > 0 && (
              <SearchGroup title="Propostas" count={data.propostas.length}>
                {data.propostas.map((p) => (
                  <Link
                    key={p.id}
                    href={`/propostas/${p.id}`}
                    onClick={onClose}
                    className="block px-2 py-1.5 rounded text-[12px] hover:bg-white/5"
                  >
                    <div className="font-medium">{p.numero}</div>
                    <div className="text-[11px] text-vg-fg-3">{p.cliente.nome} · {p.status}</div>
                  </Link>
                ))}
              </SearchGroup>
            )}
            {data.contratos.length > 0 && (
              <SearchGroup title="Contratos" count={data.contratos.length}>
                {data.contratos.map((c) => (
                  <Link
                    key={c.id}
                    href={`/contratos/${c.id}`}
                    onClick={onClose}
                    className="block px-2 py-1.5 rounded text-[12px] hover:bg-white/5"
                  >
                    <div className="font-medium">{c.numero}</div>
                    <div className="text-[11px] text-vg-fg-3">{c.cliente.nome} · {c.statusAssinatura ?? '—'}</div>
                  </Link>
                ))}
              </SearchGroup>
            )}
            {data.boletos.length > 0 && (
              <SearchGroup title="Boletos" count={data.boletos.length}>
                {data.boletos.map((b) => (
                  <Link
                    key={b.id}
                    href={`/boletos/${b.id}`}
                    onClick={onClose}
                    className="block px-2 py-1.5 rounded text-[12px] hover:bg-white/5"
                  >
                    <div className="font-medium">{b.numero}</div>
                    <div className="text-[11px] text-vg-fg-3">{b.status}</div>
                  </Link>
                ))}
              </SearchGroup>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SearchGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-vg-fg-3 px-2 mb-1">{title} ({count})</div>
      {children}
    </div>
  )
}
