'use client'
import * as React from 'react'
import { Sparkline } from './Sparkline'
import { cn } from '@/lib/utils/cn'

export interface WatchlistRowProps {
  symbol: string
  ticker: string
  value: string
  delta: { value: string; trend: 'pos' | 'neg' }
  sparklineData: number[]
  className?: string
}

export function WatchlistRow({
  symbol,
  ticker,
  value,
  delta,
  sparklineData,
  className,
}: WatchlistRowProps) {
  const sparkColor = delta.trend === 'neg' ? 'var(--neg)' : 'var(--pos)'
  const deltaColor = delta.trend === 'neg' ? 'text-neg' : 'text-pos'

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 py-3 border-b border-border-1 last:border-0',
        className,
      )}
    >
      <div className="flex flex-col min-w-0">
        <span className="text-fg-1 text-body truncate">{symbol}</span>
        <span className="text-fg-3 text-micro uppercase tracking-wider truncate">
          {ticker}
        </span>
      </div>
      <div className="w-16 h-8 shrink-0">
        <Sparkline data={sparklineData} color={sparkColor} height={32} />
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span className="t-num text-fg-1 text-body">{value}</span>
        <span className={cn('t-num text-small', deltaColor)}>{delta.value}</span>
      </div>
    </div>
  )
}

export interface WatchlistListProps {
  items: WatchlistRowProps[]
  className?: string
}

export function WatchlistList({ items, className }: WatchlistListProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      {items.map((item, i) => (
        <WatchlistRow key={`${item.ticker}-${i}`} {...item} />
      ))}
    </div>
  )
}
