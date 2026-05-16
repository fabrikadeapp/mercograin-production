'use client'

import { useState } from 'react'
import { ArrowUpRight, MessageSquare, Mail, Camera, Globe } from 'lucide-react'
import Link from 'next/link'
import { GlassCard, Skeleton, ErrorState, EmptyState, fmtTime, useJson } from './_shared'

type Channel = 'all' | 'whatsapp' | 'email' | 'instagram' | 'portal'

interface Conv {
  id: string
  channel: 'whatsapp' | 'email' | 'instagram' | 'portal'
  contactName: string | null
  lastMessageText: string | null
  lastMessageAt: string | null
  unreadCount: number
  aiStatus: string
  silenced?: boolean
}

interface Resp {
  conversations: Conv[]
  counts: { total: number; byChannel: Record<string, number> }
}

/** Ícone + cor temática por canal — quadrado arredondado lime/azul/laranja/cinza. */
const CHANNEL_STYLE: Record<
  Conv['channel'],
  { icon: typeof MessageSquare; bg: string; fg: string; border: string }
> = {
  whatsapp: {
    icon: MessageSquare,
    bg: 'rgba(74, 222, 128, 0.12)',
    fg: 'var(--success)',
    border: 'rgba(74, 222, 128, 0.25)',
  },
  email: {
    icon: Mail,
    bg: 'rgba(127, 168, 255, 0.14)',
    fg: '#A8C5FF',
    border: 'rgba(127, 168, 255, 0.3)',
  },
  instagram: {
    icon: Camera,
    bg: 'rgba(245, 168, 107, 0.14)',
    fg: '#F5C58B',
    border: 'rgba(245, 168, 107, 0.3)',
  },
  portal: {
    icon: Globe,
    bg: 'var(--surface-2)',
    fg: 'var(--text-mute)',
    border: 'var(--border)',
  },
}

const CHANNEL_LABEL: Record<Conv['channel'], string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  instagram: 'Instagram',
  portal: 'Portal',
}

interface InboxCardProps {
  onOpenConversa?: (conversationId: string) => void
}

export function InboxCard({ onOpenConversa }: InboxCardProps = {}) {
  const [channel, setChannel] = useState<Channel>('all')
  const { data, error, loading } = useJson<Resp>(`/api/inbox?channel=${channel}&limit=6`, [channel])

  const tabs: Array<{ k: Channel; label: string; count: number }> = [
    { k: 'all', label: 'Todos', count: data?.counts.total ?? 0 },
    { k: 'whatsapp', label: 'WhatsApp', count: data?.counts.byChannel.whatsapp ?? 0 },
    { k: 'email', label: 'E-mail', count: data?.counts.byChannel.email ?? 0 },
    { k: 'portal', label: 'Portal', count: data?.counts.byChannel.portal ?? 0 },
    { k: 'instagram', label: 'Instagram', count: data?.counts.byChannel.instagram ?? 0 },
  ]

  return (
    <GlassCard
      title="Inbox unificado"
      subtitle="mensagens e cotações em um só lugar"
      status={{ online: !error, label: error ? 'Erro' : 'Online' }}
      action={
        <Link
          href="/whatsapp"
          className="text-[11px] flex items-center gap-1 transition"
          style={{ color: 'var(--text-mute)' }}
        >
          Ver todas <ArrowUpRight className="w-3 h-3" />
        </Link>
      }
    >
      {/* Chips inline com contador — Todos · 5  WhatsApp · 2  ... */}
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mb-3">
        {tabs.map((t) => {
          const active = channel === t.k
          return (
            <button
              key={t.k}
              type="button"
              onClick={() => setChannel(t.k)}
              className="transition"
              style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 6,
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--text)' : 'var(--text-mute)',
                cursor: 'pointer',
              }}
            >
              <span>{t.label}</span>
              <span
                className="tabular-nums"
                style={{
                  fontSize: 11,
                  color: 'var(--text-dim)',
                  fontFamily: 'var(--f-mono)',
                }}
              >
                · {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message="Erro ao carregar inbox" />
      ) : !data || data.conversations.length === 0 ? (
        <EmptyState message="Nenhuma mensagem recebida" />
      ) : (
        <ul>
          {data.conversations.slice(0, 5).map((c, idx) => {
            const cs = CHANNEL_STYLE[c.channel] ?? CHANNEL_STYLE.portal
            const Icon = cs.icon
            const nome = c.contactName ?? '—'
            // Sufixo do nome — "— Stewart Manasse" (email) ou "· Portal" (portal)
            const sufixoNome =
              c.channel === 'email' && nome.length < 50
                ? '' // sem sufixo extra; nome já pode ter " — Pessoa"
                : c.channel === 'portal'
                  ? ' · Portal'
                  : ''
            const content = (
              <div
                className="flex items-start gap-3"
                style={{
                  paddingTop: 14,
                  paddingBottom: 14,
                  paddingLeft: 4,
                  paddingRight: 4,
                  borderTop: idx === 0 ? '1px solid var(--border)' : 'none',
                  borderBottom: '1px solid var(--border)',
                  // Silenciada: estilo opaco — chegou durante pausa do canal
                  opacity: c.silenced ? 0.5 : 1,
                  fontStyle: c.silenced ? 'italic' : 'normal',
                }}
              >
                {/* Ícone do canal, quadrado arredondado colorido */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: cs.bg,
                    border: `1px solid ${cs.border}`,
                    color: cs.fg,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                  aria-label={CHANNEL_LABEL[c.channel]}
                  title={CHANNEL_LABEL[c.channel]}
                >
                  <Icon className="w-4 h-4" />
                </div>

                {/* Texto */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <div
                      className="truncate flex items-center gap-2"
                      style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}
                    >
                      <span className="truncate">
                        {nome}
                        {sufixoNome}
                      </span>
                      {c.silenced && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: 999,
                            background: 'var(--surface-3)',
                            color: 'var(--text-dim)',
                            fontStyle: 'normal',
                            fontFamily: 'var(--f-mono)',
                            letterSpacing: '0.03em',
                            textTransform: 'uppercase',
                          }}
                          title="Recebida com o canal pausado — não passou pela IA. Reative o canal para processar."
                        >
                          Silenciada
                        </span>
                      )}
                    </div>
                    <div
                      className="shrink-0"
                      style={{ fontSize: 11, color: 'var(--text-dim)' }}
                    >
                      {fmtTime(c.lastMessageAt)}
                    </div>
                  </div>
                  <div
                    className="truncate mt-0.5"
                    style={{ fontSize: 13, color: 'var(--text-mute)' }}
                  >
                    {c.lastMessageText ?? '(sem mensagem)'}
                  </div>
                </div>

                {/* Badge unread, discreto — só quando NÃO silenciada */}
                {c.unreadCount > 0 && !c.silenced && (
                  <div
                    className="tabular-nums shrink-0"
                    style={{
                      minWidth: 18,
                      height: 18,
                      borderRadius: 999,
                      background: 'var(--accent)',
                      color: 'var(--accent-ink)',
                      fontSize: 10,
                      fontWeight: 700,
                      display: 'grid',
                      placeItems: 'center',
                      padding: '0 5px',
                      alignSelf: 'center',
                    }}
                    title={`${c.unreadCount} nova${c.unreadCount === 1 ? '' : 's'}`}
                  >
                    {c.unreadCount > 9 ? '9+' : c.unreadCount}
                  </div>
                )}
              </div>
            )

            return (
              <li key={c.id}>
                {onOpenConversa ? (
                  <button
                    type="button"
                    onClick={() => onOpenConversa(c.id)}
                    className="w-full text-left transition"
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--tint-2pct)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {content}
                  </button>
                ) : (
                  content
                )}
              </li>
            )
          })}
        </ul>
      )}
    </GlassCard>
  )
}
