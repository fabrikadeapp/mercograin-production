'use client'
import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface TabOption {
  value: string
  label: string
  count?: number
}

export interface TabsProps {
  options: TabOption[]
  value: string
  onChange: (v: string) => void
  size?: 'sm' | 'md'
  className?: string
}

export function Tabs({ options, value, onChange, size = 'md', className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 p-1 rounded-pill border border-border-1',
        className
      )}
      style={{ background: 'var(--bg-1)' }}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center gap-2 px-4 rounded-pill text-small font-medium transition-all',
              size === 'sm' ? 'h-7' : 'h-8',
              active
                ? 'shadow-glow'
                : 'text-fg-2 hover:text-fg-1 hover:bg-bg-2'
            )}
            style={
              active
                ? { background: 'var(--accent)', color: 'var(--accent-ink)' }
                : undefined
            }
          >
            <span>{opt.label}</span>
            {opt.count !== undefined ? (
              <span
                className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-pill text-micro font-semibold"
                style={
                  active
                    ? { background: 'var(--accent-ink)', color: 'var(--accent)' }
                    : { background: 'var(--bg-3)', color: 'var(--fg-2)' }
                }
              >
                {opt.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
