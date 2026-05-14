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
        className={`relative ml-auto w-full ${width} h-full overflow-y-auto`}
        style={{
          background: 'var(--surface-1)',
          borderLeft: '1px solid var(--border)',
          borderTopLeftRadius: 'var(--r-lg)',
          borderBottomLeftRadius: 'var(--r-lg)',
          boxShadow: 'var(--sh-3)',
        }}
      >
        <header
          className="sticky top-0 z-10 flex items-center justify-between"
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-1)',
          }}
        >
          <div className="min-w-0">
            <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }} className="truncate">
              {title}
            </h2>
            {subtitle && (
              <div className="truncate" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg transition"
            style={{ padding: 6, background: 'transparent', border: 0, color: 'var(--text-mute)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--tint-4pct)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </header>
        <div style={{ padding: 20 }}>{children}</div>
      </aside>
    </div>
  )
}
