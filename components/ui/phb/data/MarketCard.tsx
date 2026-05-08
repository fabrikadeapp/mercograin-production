'use client'
import * as React from 'react'
import { Card } from './Card'
import { Chip } from '../primitives/Chip'
import { GrainBadge, GrainVariant } from '../primitives/Badge'
import { Sparkline } from './Sparkline'
import { cn } from '@/lib/utils/cn'

export type MarketGrainColor = 'soja' | 'milho' | 'trigo' | 'usd'

const grainTokenColor: Record<MarketGrainColor, string> = {
  soja: 'var(--grain-soja)',
  milho: 'var(--grain-milho)',
  trigo: 'var(--grain-trigo)',
  usd: 'var(--grain-usd)',
}

export interface MarketCardProps {
  symbol: string
  ticker?: string
  unit?: string
  price: string
  currency?: string
  delta: { value: string; trend: 'pos' | 'neg' }
  buy?: string
  sell?: string
  sparklineData: number[]
  grainColor?: MarketGrainColor
  className?: string
  live?: boolean
  lastSync?: string
  stale?: boolean
}

export function MarketCard({
  symbol,
  ticker,
  unit,
  price,
  currency = 'R$',
  delta,
  buy,
  sell,
  sparklineData,
  grainColor = 'soja',
  className,
  live = false,
  lastSync,
  stale = false,
}: MarketCardProps) {
  const color = grainTokenColor[grainColor]
  const grainBadgeVariant: GrainVariant = grainColor

  return (
    <Card className={cn('p-5 space-y-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <GrainBadge variant={grainBadgeVariant} />
            <span className="text-fg-1 text-body font-medium truncate">{symbol}</span>
            {live ? (
              <span
                title={lastSync ? `Última atualização: ${lastSync}` : 'Ao vivo'}
                className="flex items-center gap-1 ml-1"
              >
                <span
                  className="h-1.5 w-1.5 rounded-pill"
                  style={{
                    background: stale ? 'var(--warn)' : 'var(--pos)',
                    boxShadow: stale
                      ? '0 0 0 0 var(--warn)'
                      : '0 0 0 0 var(--pos)',
                    animation: stale ? 'none' : 'phb-pulse 1.6s ease-in-out infinite',
                  }}
                />
                <span className="eyebrow" style={{ color: stale ? 'var(--warn)' : 'var(--pos)' }}>
                  {stale ? 'OFFLINE' : 'AO VIVO'}
                </span>
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-fg-3">
            {ticker ? (
              <span className="text-micro uppercase tracking-wider">{ticker}</span>
            ) : null}
            {ticker && unit ? <span className="text-micro">·</span> : null}
            {unit ? <span className="text-small">{unit}</span> : null}
          </div>
        </div>
        <Chip variant={delta.trend}>{delta.value}</Chip>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="t-num text-body text-fg-3">{currency}</span>
        <span
          className="t-num-lg"
          style={{ color, fontSize: 36, lineHeight: 1.05 }}
        >
          {price}
        </span>
      </div>

      {(buy || sell) ? (
        <div className="flex gap-8">
          {buy ? (
            <div className="space-y-0.5">
              <p className="eyebrow">Compra</p>
              <p className="t-num text-fg-2 text-body">{buy}</p>
            </div>
          ) : null}
          {sell ? (
            <div className="space-y-0.5">
              <p className="eyebrow">Venda</p>
              <p className="t-num text-fg-2 text-body">{sell}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="-mx-1">
        <Sparkline data={sparklineData} color={color} height={48} />
      </div>
    </Card>
  )
}
