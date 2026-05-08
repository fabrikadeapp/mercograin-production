'use client'
import * as React from 'react'
import { cn } from '@/lib/utils/cn'

const PALETTES = [
  { id: 'pulse', label: 'Verde Pulse', color: '#1FE08C' },
  { id: 'floresta', label: 'Floresta', color: '#2E8B5A' },
  { id: 'oliva', label: 'Oliva', color: '#B8C24E' },
  { id: 'mar', label: 'Mar', color: '#1FD9C4' },
  { id: 'sage', label: 'Sage', color: '#E8A33C' },
  { id: 'mono', label: 'Mono', color: '#4ADE9A' },
] as const

const STORAGE_KEY = 'phb:palette'

export function PaletteSwitcher({ className }: { className?: string }) {
  const [active, setActive] = React.useState<string>('pulse')

  React.useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    const initial = stored && PALETTES.some((p) => p.id === stored) ? stored : 'pulse'
    setActive(initial)
    document.documentElement.dataset.palette = initial
  }, [])

  const apply = (id: string) => {
    setActive(id)
    document.documentElement.dataset.palette = id
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {}
  }

  return (
    <div
      role="radiogroup"
      aria-label="Trocar paleta"
      className={cn('inline-flex items-center gap-2 p-1.5 rounded-pill border border-border-1', className)}
      style={{ background: 'var(--bg-1)' }}
    >
      {PALETTES.map((p) => {
        const isActive = active === p.id
        return (
          <button
            key={p.id}
            role="radio"
            aria-checked={isActive}
            type="button"
            onClick={() => apply(p.id)}
            title={p.label}
            className={cn(
              'h-7 w-7 rounded-pill transition-all flex items-center justify-center',
              isActive ? 'ring-2 ring-offset-2' : 'hover:scale-110'
            )}
            style={
              {
                ['--tw-ring-color' as string]: p.color,
                ['--tw-ring-offset-color' as string]: 'var(--bg-1)',
              } as React.CSSProperties
            }
          >
            <span
              className="h-4 w-4 rounded-pill"
              style={{ background: p.color, boxShadow: isActive ? `0 0 0 2px var(--bg-1), 0 0 12px ${p.color}66` : undefined }}
            />
          </button>
        )
      })}
    </div>
  )
}
