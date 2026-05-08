'use client'
import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export type ChipVariant = 'pos' | 'neg' | 'warn' | 'info' | 'neutral' | 'accent'

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant
  leftIcon?: React.ReactNode
}

const variantClass: Record<ChipVariant, string> = {
  pos: 'chip-pos',
  neg: 'chip-neg',
  warn: 'chip-warn',
  info: '',
  neutral: '',
  accent: '',
}

const variantInline: Partial<Record<ChipVariant, React.CSSProperties>> = {
  info: {
    background: 'color-mix(in srgb, var(--info) 16%, transparent)',
    color: 'var(--info)',
  },
  neutral: {
    background: 'var(--bg-3)',
    color: 'var(--fg-2)',
  },
  accent: {
    background: 'color-mix(in srgb, var(--accent) 18%, transparent)',
    color: 'var(--accent)',
  },
}

export const Chip = React.forwardRef<HTMLSpanElement, ChipProps>(
  ({ variant = 'neutral', leftIcon, className, style, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn('chip', variantClass[variant], className)}
        style={{ ...(variantInline[variant] || {}), ...style }}
        {...props}
      >
        {leftIcon}
        {children}
      </span>
    )
  }
)
Chip.displayName = 'Chip'
