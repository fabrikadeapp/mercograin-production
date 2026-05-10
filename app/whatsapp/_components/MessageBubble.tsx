'use client'

import * as React from 'react'
import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { InboxMessage } from './useInboxState'

interface Props {
  message: InboxMessage
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'read') return <CheckCheck className="h-3 w-3" />
  if (status === 'delivered') return <CheckCheck className="h-3 w-3 opacity-70" />
  if (status === 'sent') return <Check className="h-3 w-3 opacity-70" />
  if (status === 'pending') return <Clock className="h-3 w-3 opacity-70" />
  if (status === 'failed') return <AlertCircle className="h-3 w-3 text-neg" />
  return null
}

export function MessageBubble({ message }: Props) {
  const own = message.fromMe
  const body =
    message.text ??
    message.mediaCaption ??
    (message.mediaType ? `[${message.mediaType}]` : '')

  return (
    <div className={cn('flex w-full', own ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-md px-3 py-2 text-small whitespace-pre-wrap break-words',
          own
            ? 'bg-accent text-accent-ink'
            : 'bg-bg-2 border border-border-1 text-fg-1'
        )}
        style={
          own
            ? { background: 'var(--accent)', color: 'var(--accent-ink)' }
            : undefined
        }
      >
        <div>{body || <span className="opacity-60">[sem conteúdo]</span>}</div>
        <div
          className={cn(
            'flex items-center gap-1 justify-end mt-1 text-micro t-num',
            own ? 'opacity-80' : 'text-fg-3'
          )}
        >
          <span>{fmtTime(message.timestamp)}</span>
          {own ? <StatusIcon status={message.status} /> : null}
        </div>
      </div>
    </div>
  )
}
