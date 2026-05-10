'use client'

import * as React from 'react'
import { MessageSquare } from 'lucide-react'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import type { InboxContact, InboxMessage } from './useInboxState'

interface Props {
  contact: InboxContact | null
  messages: InboxMessage[]
  loading: boolean
  sending: boolean
  onSend: (text: string) => Promise<boolean>
}

function initials(name: string | null, fallback: string): string {
  const src = name || fallback
  const parts = src.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Conversation({
  contact,
  messages,
  loading,
  sending,
  onSend,
}: Props) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const stickToBottomRef = React.useRef(true)
  const lastMsgIdRef = React.useRef<string | null>(null)
  const lastContactIdRef = React.useRef<string | null>(null)

  // Track whether user is near bottom (within 80px). If yes, auto-scroll
  // when new messages arrive; if no, respect user's reading position.
  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottomRef.current = distFromBottom < 80
  }

  // Scroll on contact change (always go to bottom).
  React.useEffect(() => {
    const cid = contact?.id ?? null
    if (cid !== lastContactIdRef.current) {
      lastContactIdRef.current = cid
      stickToBottomRef.current = true
      requestAnimationFrame(() => {
        const el = scrollRef.current
        if (el) el.scrollTop = el.scrollHeight
      })
    }
  }, [contact?.id])

  // Scroll on new messages (only if stuck to bottom).
  React.useEffect(() => {
    const last = messages[messages.length - 1]
    const lastId = last?.id ?? null
    if (lastId !== lastMsgIdRef.current) {
      lastMsgIdRef.current = lastId
      if (stickToBottomRef.current) {
        requestAnimationFrame(() => {
          const el = scrollRef.current
          if (el) el.scrollTop = el.scrollHeight
        })
      }
    }
  }, [messages])

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-bg-2 text-center px-6">
        <MessageSquare className="h-10 w-10 text-fg-3 mb-3" />
        <p className="text-fg-1 font-semibold">Selecione um contato</p>
        <p className="text-fg-3 text-small mt-1 max-w-md">
          Escolha uma conversa à esquerda para visualizar as mensagens e
          responder.
        </p>
      </div>
    )
  }

  const name = contact.pushName || contact.phone || contact.jid.split('@')[0]
  const subtitle = contact.phone || contact.jid.split('@')[0]

  return (
    <div className="flex flex-col h-full min-h-0 bg-bg-2">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-1 bg-bg-1">
        <div
          className="h-10 w-10 rounded-pill bg-bg-3 border border-border-2 flex items-center justify-center text-fg-1 text-small font-semibold"
          aria-hidden="true"
        >
          {initials(contact.pushName, contact.phone || contact.jid)}
        </div>
        <div className="min-w-0">
          <p className="text-fg-1 font-semibold truncate">{name}</p>
          <p className="text-fg-3 text-micro t-num truncate">{subtitle}</p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-2 min-h-0"
      >
        {loading && messages.length === 0 ? (
          <p className="text-fg-3 text-small text-center py-8">Carregando…</p>
        ) : messages.length === 0 ? (
          <p className="text-fg-3 text-small text-center py-8">
            Nenhuma mensagem ainda. Envie a primeira!
          </p>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
      </div>

      {/* Input */}
      <MessageInput onSend={onSend} sending={sending} />
    </div>
  )
}
