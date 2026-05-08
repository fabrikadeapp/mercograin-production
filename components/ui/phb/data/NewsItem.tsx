'use client'
import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface NewsItemProps {
  title: string
  meta: string
  className?: string
}

export function NewsItem({ title, meta, className }: NewsItemProps) {
  return (
    <div
      className={cn(
        'py-3 border-b border-border-1 last:border-0 space-y-1',
        className,
      )}
    >
      <p className="eyebrow">{meta}</p>
      <p className="text-fg-1 text-small leading-snug">{title}</p>
    </div>
  )
}
