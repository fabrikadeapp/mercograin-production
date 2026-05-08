'use client'
import * as React from 'react'
import { Card } from './Card'
import { Chip } from '../primitives/Chip'
import { cn } from '@/lib/utils/cn'

export interface PipelineStageCardProps {
  stage: string
  count: number
  percent: number
  total: string
  color?: string
  className?: string
}

export function PipelineStageCard({
  stage,
  count,
  percent,
  total,
  color = 'var(--accent)',
  className,
}: PipelineStageCardProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <Card className={cn('p-5 space-y-3', className)}>
      <p className="eyebrow">{stage}</p>
      <div className="flex items-baseline gap-3">
        <span className="t-num-lg text-fg-1">{count}</span>
        <Chip variant="neutral">{`${percent}%`}</Chip>
      </div>
      <p className="text-fg-3 text-small t-num">{total}</p>
      <div className="h-1 w-full bg-bg-3 rounded-pill overflow-hidden">
        <div
          className="h-full rounded-pill"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
    </Card>
  )
}
