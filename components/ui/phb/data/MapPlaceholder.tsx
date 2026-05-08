'use client'
import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface MapPlaceholderProps {
  className?: string
  size?: number
}

export function MapPlaceholder({ className, size = 192 }: MapPlaceholderProps) {
  return (
    <div
      className={cn(
        'relative bg-bg-inset rounded-md border border-border-1 overflow-hidden',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 200 200"
        className="absolute inset-0 w-full h-full"
        fill="none"
        stroke="var(--border-2)"
        strokeWidth="1"
      >
        <path d="M30 60 Q60 40 90 55 T160 50 L170 90 Q150 120 130 110 T80 130 Q50 140 35 110 Z" />
        <path d="M50 80 Q70 70 95 80 T140 80" opacity="0.5" />
      </svg>
      <span
        className="absolute h-2 w-2 rounded-pill"
        style={{ top: '40%', left: '32%', background: 'var(--accent)' }}
      />
      <span
        className="absolute h-2 w-2 rounded-pill"
        style={{ top: '58%', left: '60%', background: 'var(--accent)' }}
      />
    </div>
  )
}
