'use client'
import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface DemandItem {
  label: string
  value: string
  amount: number
  color: string
}

export interface DemandListProps {
  items: DemandItem[]
  className?: string
}

export function DemandList({ items, className }: DemandListProps) {
  const max = Math.max(...items.map((i) => i.amount), 1)
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {items.map((it) => {
        const pct = (it.amount / max) * 100
        return (
          <div key={it.label} className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span
                className="h-2.5 w-2.5 rounded-pill shrink-0"
                style={{ background: it.color }}
                aria-hidden="true"
              />
              <span className="flex-1 text-fg-1 text-small truncate">{it.label}</span>
              <span className="t-num text-fg-1 text-small">{it.value}</span>
            </div>
            <div className="h-1 w-full bg-bg-3 rounded-pill overflow-hidden">
              <div
                className="h-full rounded-pill"
                style={{ width: `${pct}%`, background: it.color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
