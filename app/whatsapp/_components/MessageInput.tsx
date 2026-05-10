'use client'

import * as React from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/phb'

interface Props {
  onSend: (text: string) => Promise<boolean> | boolean
  sending: boolean
  disabled?: boolean
}

export function MessageInput({ onSend, sending, disabled }: Props) {
  const [text, setText] = React.useState('')
  const ref = React.useRef<HTMLTextAreaElement>(null)

  // Auto-resize
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [text])

  const submit = async () => {
    const trimmed = text.trim()
    if (!trimmed || sending || disabled) return
    const ok = await onSend(trimmed)
    if (ok) setText('')
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-border-1 bg-bg-1 p-3">
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Digite uma mensagem…"
        rows={1}
        maxLength={4096}
        disabled={disabled}
        className="flex-1 resize-none rounded-md border border-border-1 bg-bg-2 px-3 py-2 text-small text-fg-1 placeholder:text-fg-3 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
      />
      <Button
        type="button"
        onClick={submit}
        loading={sending}
        disabled={!text.trim() || disabled}
        leftIcon={<Send className="h-4 w-4" />}
      >
        Enviar
      </Button>
    </div>
  )
}
