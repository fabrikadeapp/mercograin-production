'use client'

import { useState } from 'react'
import { ArrowUpRight, MessageSquare, Mail, AtSign, Globe } from 'lucide-react'
import Link from 'next/link'
import { GlassCard, Avatar, Badge, Skeleton, ErrorState, EmptyState, fmtTime, useJson } from './_shared'

type Channel = 'all' | 'whatsapp' | 'email' | 'instagram' | 'portal'

interface Conv {
  id: string
  channel: 'whatsapp' | 'email' | 'instagram' | 'portal'
  contactName: string | null
  lastMessageText: string | null
  lastMessageAt: string | null
  unreadCount: number
  aiStatus: string
}

interface Resp {
  conversations: Conv[]
  counts: { total: number; byChannel: Record<string, number> }
}

const aiStatusLabel: Record<string, { label: string; tone: 'info' | 'success' | 'warn' | 'danger' | 'neutral' }> = {
  aguardando: { label: 'Aguardando leitura', tone: 'warn' },
  lida: { label: 'Lida pela IA', tone: 'info' },
  classificado: { label: 'Classificado', tone: 'info' },
  pronta_para_proposta: { label: 'Pronta para proposta', tone: 'success' },
  pendente_info: { label: 'Pendente de informação', tone: 'warn' },
  nao_comercial: { label: 'Não comercial', tone: 'neutral' },
  erro_leitura: { label: 'Erro de leitura', tone: 'danger' },
}

function channelIcon(ch: Conv['channel']) {
  const cls = 'w-3 h-3'
  if (ch === 'whatsapp') return <MessageSquare className={cls} />
  if (ch === 'email') return <Mail className={cls} />
  if (ch === 'instagram') return <AtSign className={cls} />
  return <Globe className={cls} />
}

interface InboxCardProps {
  onOpenConversa?: (conversationId: string) => void
}

export function InboxCard({ onOpenConversa }: InboxCardProps = {}) {
  const [channel, setChannel] = useState<Channel>('all')
  const { data, error, loading } = useJson<Resp>(`/api/inbox?channel=${channel}&limit=6`, [channel])

  const tabs: Array<{ k: Channel; label: string; count: number | null }> = [
    { k: 'all', label: 'Todos', count: data?.counts.total ?? null },
    { k: 'whatsapp', label: 'WhatsApp', count: data?.counts.byChannel.whatsapp ?? null },
    { k: 'email', label: 'E-mail', count: data?.counts.byChannel.email ?? null },
    { k: 'instagram', label: 'Instagram', count: data?.counts.byChannel.instagram ?? null },
    { k: 'portal', label: 'Portal', count: data?.counts.byChannel.portal ?? null },
  ]

  return (
    <GlassCard
      title="Inbox unificado"
      subtitle="Mensagens e cotações em um só lugar"
      status={{ online: !error, label: error ? 'Erro' : 'Online' }}
      action={
        <Link href="/whatsapp" className="text-[11px] text-vg-fg-3 hover:text-vg-fg-primary flex items-center gap-1">
          Ver todas <ArrowUpRight className="w-3 h-3" />
        </Link>
      }
    >
      <div className="flex items-center gap-1 mb-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() => setChannel(t.k)}
            className={`text-[11px] px-2 py-1 rounded-full whitespace-nowrap transition ${channel === t.k ? 'font-semibold' : 'opacity-70 hover:opacity-100'}`}
            style={{
              background: channel === t.k ? 'var(--vg-accent-primary)' : 'var(--vg-glass-pill-track)',
              color: channel === t.k ? '#fff' : 'var(--vg-fg-2)',
            }}
          >
            {t.label} {t.count != null && t.count > 0 ? t.count : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message="Erro ao carregar inbox" />
      ) : !data || data.conversations.length === 0 ? (
        <EmptyState message="Nenhuma mensagem recebida" />
      ) : (
        <ul className="space-y-1.5">
          {data.conversations.slice(0, 5).map((c) => {
            const stat = aiStatusLabel[c.aiStatus] ?? aiStatusLabel.aguardando
            const iniciais = (c.contactName ?? '?')
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0]!.toUpperCase())
              .join('')
            const content = (
              <>
                <Avatar initials={iniciais} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-[12px] font-medium truncate flex items-center gap-1">
                      <span className="text-vg-fg-3">{channelIcon(c.channel)}</span>
                      {c.contactName ?? '—'}
                    </div>
                    <div className="text-[10px] text-vg-fg-3 shrink-0">{fmtTime(c.lastMessageAt)}</div>
                  </div>
                  <div className="text-[11px] text-vg-fg-2 truncate">{c.lastMessageText ?? '(sem mensagem)'}</div>
                  <div className="mt-0.5">
                    <Badge tone={stat.tone} label={stat.label} />
                    {c.unreadCount > 0 && (
                      <span className="ml-1">
                        <Badge tone="info" label={`${c.unreadCount} novas`} />
                      </span>
                    )}
                  </div>
                </div>
              </>
            )
            return (
              <li key={c.id}>
                {onOpenConversa ? (
                  <button
                    type="button"
                    onClick={() => onOpenConversa(c.id)}
                    className="w-full text-left flex items-start gap-2.5 py-1 px-1.5 -mx-1.5 rounded-lg hover:bg-white/5 transition"
                  >
                    {content}
                  </button>
                ) : (
                  <div className="flex items-start gap-2.5 py-1">{content}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </GlassCard>
  )
}
