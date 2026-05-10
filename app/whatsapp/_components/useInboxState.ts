'use client'

import * as React from 'react'

export interface InboxContact {
  id: string
  jid: string
  phone: string | null
  pushName: string | null
  profilePicUrl: string | null
  lastMessageAt: string | null
  unreadCount: number
  lastMessage: {
    id: string
    text: string | null
    fromMe: boolean
    mediaType: string | null
    timestamp: string
    status: string
  } | null
}

export interface InboxMessage {
  id: string
  contactId: string
  messageId: string
  remoteJid: string
  fromMe: boolean
  text: string | null
  mediaType: string | null
  mediaCaption: string | null
  status: string
  timestamp: string
}

export interface InboxState {
  contacts: InboxContact[]
  loadingContacts: boolean
  selectedContactId: string | null
  selectContact: (id: string) => void
  messages: InboxMessage[]
  loadingMessages: boolean
  sending: boolean
  send: (text: string) => Promise<boolean>
  refresh: () => void
}

const POLL_CONTACTS_MS = 5000
const POLL_MESSAGES_MS = 3000

export function useInboxState(opts: { enabled: boolean }): InboxState {
  const { enabled } = opts
  const [contacts, setContacts] = React.useState<InboxContact[]>([])
  const [loadingContacts, setLoadingContacts] = React.useState(false)
  const [selectedContactId, setSelectedContactId] = React.useState<string | null>(
    null
  )
  const [messages, setMessages] = React.useState<InboxMessage[]>([])
  const [loadingMessages, setLoadingMessages] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [tick, setTick] = React.useState(0)

  const fetchContacts = React.useCallback(async () => {
    try {
      const r = await fetch('/api/whatsapp/messages?groupBy=contact&limit=200', {
        cache: 'no-store',
      })
      if (!r.ok) return
      const d = await r.json()
      setContacts(Array.isArray(d.data) ? d.data : [])
    } catch {
      /* swallow */
    }
  }, [])

  const fetchMessages = React.useCallback(async (contactId: string) => {
    try {
      const r = await fetch(
        `/api/whatsapp/messages?contactId=${encodeURIComponent(
          contactId
        )}&limit=100`,
        { cache: 'no-store' }
      )
      if (!r.ok) return
      const d = await r.json()
      // Backend retorna desc; convertemos pra asc (mais antiga em cima).
      const list: InboxMessage[] = Array.isArray(d.data) ? [...d.data].reverse() : []
      setMessages(list)
    } catch {
      /* swallow */
    }
  }, [])

  // Initial + poll: contacts
  React.useEffect(() => {
    if (!enabled) return
    let cancelled = false
    ;(async () => {
      setLoadingContacts(true)
      await fetchContacts()
      if (!cancelled) setLoadingContacts(false)
    })()
    const id = setInterval(fetchContacts, POLL_CONTACTS_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [enabled, fetchContacts, tick])

  // Initial + poll: messages of selected contact
  React.useEffect(() => {
    if (!enabled || !selectedContactId) {
      setMessages([])
      return
    }
    let cancelled = false
    ;(async () => {
      setLoadingMessages(true)
      await fetchMessages(selectedContactId)
      if (!cancelled) setLoadingMessages(false)
    })()
    const id = setInterval(() => {
      if (!cancelled) fetchMessages(selectedContactId)
    }, POLL_MESSAGES_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [enabled, selectedContactId, fetchMessages])

  const selectContact = React.useCallback(
    (id: string) => {
      setSelectedContactId(id)
      // Mark as read (best-effort)
      fetch(`/api/whatsapp/contacts/${id}/mark-read`, { method: 'POST' }).catch(
        () => undefined
      )
      // Refletir local imediatamente
      setContacts((cs) =>
        cs.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
      )
    },
    []
  )

  const send = React.useCallback(
    async (text: string): Promise<boolean> => {
      if (!selectedContactId || !text.trim()) return false
      const contact = contacts.find((c) => c.id === selectedContactId)
      if (!contact) return false
      const number = contact.phone || contact.jid.split('@')[0]
      setSending(true)
      try {
        const r = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ number, text }),
        })
        if (!r.ok) return false
        // Otimismo: re-fetch mensagens em seguida
        await fetchMessages(selectedContactId)
        await fetchContacts()
        return true
      } catch {
        return false
      } finally {
        setSending(false)
      }
    },
    [selectedContactId, contacts, fetchMessages, fetchContacts]
  )

  const refresh = React.useCallback(() => setTick((t) => t + 1), [])

  return {
    contacts,
    loadingContacts,
    selectedContactId,
    selectContact,
    messages,
    loadingMessages,
    sending,
    send,
    refresh,
  }
}
