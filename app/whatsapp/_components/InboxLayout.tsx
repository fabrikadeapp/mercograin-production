'use client'

import * as React from 'react'
import { ContactList } from './ContactList'
import { Conversation } from './Conversation'
import { useInboxState } from './useInboxState'

interface Props {
  enabled: boolean
}

export function InboxLayout({ enabled }: Props) {
  const inbox = useInboxState({ enabled })
  const selected =
    inbox.contacts.find((c) => c.id === inbox.selectedContactId) || null

  return (
    <div
      className="grid h-[calc(100vh-12rem)] min-h-[520px] border border-border-1 rounded-md overflow-hidden bg-bg-1"
      style={{ gridTemplateColumns: '360px 1fr' }}
    >
      <ContactList
        contacts={inbox.contacts}
        selectedId={inbox.selectedContactId}
        onSelect={inbox.selectContact}
        loading={inbox.loadingContacts}
      />
      <Conversation
        contact={selected}
        messages={inbox.messages}
        loading={inbox.loadingMessages}
        sending={inbox.sending}
        onSend={inbox.send}
      />
    </div>
  )
}
