'use client'
import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export type RiskLevel = 'baixo' | 'medio' | 'alto'

export interface RiskBadgeProps {
  level: RiskLevel | number
  className?: string
}

function normalize(level: RiskLevel | number): RiskLevel {
  if (typeof level === 'string') return level
  if (level <= 2) return 'baixo'
  if (level === 3) return 'medio'
  return 'alto'
}

const CONFIG: Record<RiskLevel, { label: string; bg: string; fg: string; dot: string }> = {
  baixo: {
    label: 'Baixo',
    bg: 'rgba(15, 115, 5, 0.10)',
    fg: 'var(--pos)',
    dot: 'var(--pos)',
  },
  medio: {
    label: 'Médio',
    bg: 'rgba(232, 159, 42, 0.14)',
    fg: 'var(--warn)',
    dot: 'var(--warn)',
  },
  alto: {
    label: 'Alto',
    bg: 'rgba(211, 47, 47, 0.10)',
    fg: 'var(--neg)',
    dot: 'var(--neg)',
  },
}

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const key = normalize(level)
  const c = CONFIG[key]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-micro font-medium',
        className,
      )}
      style={{ background: c.bg, color: c.fg }}
      aria-label={`Risco ${c.label}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-pill"
        style={{ background: c.dot }}
        aria-hidden
      />
      {c.label}
    </span>
  )
}
