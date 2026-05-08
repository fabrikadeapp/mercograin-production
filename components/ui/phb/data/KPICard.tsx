'use client'
import * as React from 'react'
import { Card } from './Card'
import { Chip } from '../primitives/Chip'
import { Sparkline } from './Sparkline'
import { cn } from '@/lib/utils/cn'

export interface KPIDelta {
  value: string
  trend: 'pos' | 'neg' | 'neutral'
}

export interface KPICardProps {
  eyebrow: string
  delta?: KPIDelta
  value: string
  subtitle?: string
  sparklineData?: number[]
  sparklineColor?: string
  highlightValue?: boolean
  className?: string
}

export function KPICard({
  eyebrow,
  delta,
  value,
  subtitle,
  sparklineData,
  sparklineColor,
  highlightValue,
  className,
}: KPICardProps) {
  const valueClass =
    highlightValue || delta?.trend === 'pos'
      ? 't-num-lg text-accent'
      : 't-num-lg text-fg-1'

  return (
    <Card className={cn('p-5 space-y-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">{eyebrow}</p>
        {delta ? (
          <Chip variant={delta.trend === 'neutral' ? 'neutral' : delta.trend}>
            {delta.value}
          </Chip>
        ) : null}
      </div>
      <p className={valueClass}>{value}</p>
      {subtitle ? <p className="text-fg-3 text-small">{subtitle}</p> : null}
      {sparklineData && sparklineData.length > 0 ? (
        <div className="-mx-1">
          <Sparkline
            data={sparklineData}
            color={sparklineColor ?? 'var(--accent)'}
            height={48}
          />
        </div>
      ) : null}
    </Card>
  )
}
