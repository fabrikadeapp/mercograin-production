'use client'

import { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface Props {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
}

/**
 * Modal de confirmação simples (substitui `confirm()` nativo do browser).
 * Estética alinhada ao resto do BH Grain (glass card, dark, Escape fecha,
 * click fora cancela, foco aprisionado pelo overflow:hidden no body).
 */
export function ConfirmModal({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  busy = false,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
      if (e.key === 'Enter' && !busy) onConfirm()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, busy, onCancel, onConfirm])

  if (!open) return null

  const confirmBg = destructive ? 'var(--vg-destructive, #ef4444)' : 'var(--vg-accent-primary, #3b82f6)'
  const iconBg = destructive ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)'
  const iconColor = destructive ? 'var(--vg-destructive, #ef4444)' : 'var(--vg-accent-primary, #3b82f6)'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={() => !busy && onCancel()}
      />
      <div
        className="relative w-full max-w-md rounded-2xl p-5"
        style={{
          background: 'var(--vg-bg-primary, #0a0a0a)',
          border: '1px solid var(--vg-border-subtle, rgba(255,255,255,0.1))',
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: iconBg, color: iconColor }}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="confirm-modal-title" className="text-base font-semibold">{title}</h3>
            {description && <p className="text-sm opacity-80 mt-1">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-sm px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            autoFocus
            className="text-sm px-3 py-1.5 rounded font-semibold disabled:opacity-50"
            style={{ background: confirmBg, color: '#fff' }}
          >
            {busy ? 'Processando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
