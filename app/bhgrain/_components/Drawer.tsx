'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 'max-w-2xl',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex" aria-modal="true" role="dialog">
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />
      <aside
        className={`relative ml-auto w-full ${width} h-full overflow-y-auto vg-glass-card rounded-l-2xl shadow-2xl`}
        style={{ background: 'var(--vg-bg-primary, #0a0a0a)' }}
      >
        <header
          className="sticky top-0 z-10 flex items-center justify-between p-4 border-b"
          style={{ borderColor: 'var(--vg-border-subtle)', background: 'var(--vg-bg-primary, #0a0a0a)' }}
        >
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight truncate">{title}</h2>
            {subtitle && <div className="text-[11px] text-vg-fg-3 truncate">{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </header>
        <div className="p-4">{children}</div>
      </aside>
    </div>
  )
}
