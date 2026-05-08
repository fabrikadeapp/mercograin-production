'use client'
import * as React from 'react'

export interface BrandProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Brand({ size = 'md', className }: BrandProps) {
  const sizes = {
    sm: { box: 'h-7 w-7', icon: 'h-3.5 w-3.5', text: 'text-small' },
    md: { box: 'h-8 w-8', icon: 'h-4 w-4', text: 'text-body' },
    lg: { box: 'h-10 w-10', icon: 'h-5 w-5', text: 'text-h3' },
  }
  const s = sizes[size]
  return (
    <div className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <div
        className={`${s.box} rounded-pill border border-border-2 bg-bg-2 flex items-center justify-center`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className={s.icon}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2c4 3 6 7 6 10a6 6 0 1 1-12 0c0-3 2-7 6-10z" />
          <path d="M12 6v12" opacity="0.6" />
        </svg>
      </div>
      <div className={`${s.text} font-semibold leading-none`}>
        <span className="text-fg-1">PHB</span>
        <span className="text-accent ml-1">Green</span>
      </div>
    </div>
  )
}
