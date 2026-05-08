'use client'
import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface ProgressBarProps {
  label?: string
  value: number
  color?: string
  showValue?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function ProgressBar({
  label,
  value,
  color = 'var(--accent)',
  showValue = true,
  size = 'md',
  className,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value))
  const trackHeight = size === 'sm' ? 'h-1.5' : 'h-2'

  return (
    <div className={cn('space-y-2', className)}>
      {(label || showValue) ? (
        <div className="flex items-center justify-between text-small">
          {label ? <span className="text-fg-2">{label}</span> : <span />}
          {showValue ? (
            <span className="t-num text-fg-1">{Math.round(clamped)}%</span>
          ) : null}
        </div>
      ) : null}
      <div
        className={cn(
          'bg-bg-3 rounded-pill overflow-hidden w-full',
          trackHeight,
        )}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-pill transition-all duration-500 ease-out"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
    </div>
  )
}
