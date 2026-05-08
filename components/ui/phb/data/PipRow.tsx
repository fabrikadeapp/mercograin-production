'use client'
import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface PipRowProps {
  level: number
  size?: 'sm' | 'md'
  className?: string
}

function pipColor(level: number): string {
  if (level <= 2) return 'var(--pos)'
  if (level === 3) return 'var(--warn)'
  return 'var(--neg)'
}

export function PipRow({ level, size = 'md', className }: PipRowProps) {
  const clamped = Math.max(0, Math.min(5, Math.floor(level)))
  const active = pipColor(clamped)
  const dims = size === 'sm' ? 'h-3 w-2' : 'h-3.5 w-2.5'

  return (
    <div
      className={cn('inline-flex items-center gap-0.5', className)}
      role="meter"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={5}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const isOn = i < clamped
        return (
          <span
            key={i}
            className={cn(dims, 'rounded-xs')}
            style={{ background: isOn ? active : 'var(--bg-3)' }}
          />
        )
      })}
    </div>
  )
}
