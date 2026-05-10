'use client'

import * as React from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { InboxContact } from './useInboxState'

interface Props {
  contacts: InboxContact[]
  selectedId: string | null
  onSelect: (id: string) => void
  loading: boolean
}

function initials(name: string | null, fallback: string): string {
  const src = name || fallback
  const parts = src.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function fmtRelative(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400_000)
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function preview(c: InboxContact): string {
  const m = c.lastMessage
  if (!m) return ''
  const prefix = m.fromMe ? 'Você: ' : ''
  const body = m.text || (m.mediaType ? `[${m.mediaType}]` : '')
  return prefix + body
}

export function ContactList({ contacts, selectedId, onSelect, loading }: Props) {
  const [query, setQuery] = React.useState('')

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter((c) => {
      const name = (c.pushName || '').toLowerCase()
      const phone = (c.phone || c.jid).toLowerCase()
      return name.includes(q) || phone.includes(q)
    })
  }, [contacts, query])

  return (
    <aside className="flex flex-col border-r border-border-1 bg-bg-1 h-full min-h-0">
      <div className="p-3 border-b border-border-1">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
          <input
            type="text"
            placeholder="Buscar contato"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md bg-bg-2 border border-border-1 text-small text-fg-1 placeholder:text-fg-3 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && contacts.length === 0 ? (
          <p className="text-fg-3 text-small text-center py-8">Carregando…</p>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center space-y-1">
            <p className="text-fg-2 text-small">
              {contacts.length === 0
                ? 'Nenhuma conversa ainda'
                : 'Nenhum contato encontrado'}
            </p>
            {contacts.length === 0 ? (
              <p className="text-fg-3 text-micro">
                Mensagens recebidas aparecerão aqui em tempo real.
              </p>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-border-1">
            {filtered.map((c) => {
              const isActive = c.id === selectedId
              const name = c.pushName || c.phone || c.jid.split('@')[0]
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-3 text-left transition-colors',
                      isActive
                        ? 'bg-bg-3'
                        : 'hover:bg-bg-2 focus:bg-bg-2 focus:outline-none'
                    )}
                  >
                    <div
                      className="h-10 w-10 rounded-pill bg-bg-3 border border-border-2 flex items-center justify-center text-fg-1 text-small font-semibold shrink-0"
                      aria-hidden="true"
                    >
                      {initials(c.pushName, c.phone || c.jid)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-fg-1 text-small font-medium truncate">
                          {name}
                        </span>
                        <span className="text-fg-3 text-micro shrink-0 t-num">
                          {fmtRelative(c.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-fg-3 text-micro truncate">
                          {preview(c) || (
                            <span className="italic">sem mensagens</span>
                          )}
                        </span>
                        {c.unreadCount > 0 ? (
                          <span
                            className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-pill text-micro font-semibold t-num shrink-0"
                            style={{
                              background: 'var(--accent)',
                              color: 'var(--accent-ink)',
                            }}
                          >
                            {c.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
