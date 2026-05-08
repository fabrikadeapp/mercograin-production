'use client'
import * as React from 'react'
import { Card } from './Card'
import { Chip } from '../primitives/Chip'
import { GrainBadge, GrainVariant } from '../primitives/Badge'
import { Sparkline } from './Sparkline'
import { cn } from '@/lib/utils/cn'

export type MarketGrainColor = 'soja' | 'milho' | 'trigo' | 'usd'
export type MarketState = 'open' | 'closed' | 'unknown'

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
  /** Estado do mercado: open|closed|unknown — controla bolinha verde/vermelha */
  marketState?: MarketState
  /** ISO string da última atualização da fonte */
  lastSync?: string
  /** Stale: dados antigos servidos por fallback (ex: cache miss) */
  stale?: boolean
}

/** Formata "há Xs / Xmin / Xh / Xd" a partir de um ISO em pt-BR */
function relativeTime(iso?: string, now: number = Date.now()): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return '—'
  const diff = Math.max(0, Math.floor((now - t) / 1000))
  if (diff < 5) return 'agora'
  if (diff < 60) return `há ${diff}s`
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`
  return `há ${Math.floor(diff / 86400)}d`
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
  marketState = 'unknown',
  lastSync,
  stale = false,
}: MarketCardProps) {
  const color = grainTokenColor[grainColor]
  const grainBadgeVariant: GrainVariant = grainColor

  // Re-renderiza a cada 15s para atualizar o "há Xs" sem precisar de novo fetch
  const [tick, setTick] = React.useState(0)
  React.useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 15_000)
    return () => clearInterval(id)
  }, [])

  // Status do mercado
  const isOpen = marketState === 'open' && !stale
  const isClosed = marketState === 'closed' || stale
  const dotColor = isOpen ? 'var(--pos)' : isClosed ? 'var(--neg)' : 'var(--fg-3)'
  const stateLabel = isOpen ? 'MERCADO ABERTO' : isClosed ? 'MERCADO FECHADO' : '—'
  const animation = isOpen ? 'phb-pulse 1.6s ease-in-out infinite' : 'none'

  const since = relativeTime(lastSync, Date.now() + tick * 0)  // tick força re-render

  return (
    <Card className={cn('p-5 space-y-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <GrainBadge variant={grainBadgeVariant} />
            <span className="text-fg-1 text-body font-medium truncate">{symbol}</span>
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
              <p className="eyebrow">Mínima</p>
              <p className="t-num text-fg-2 text-body">{buy}</p>
            </div>
          ) : null}
          {sell ? (
            <div className="space-y-0.5">
              <p className="eyebrow">Máxima</p>
              <p className="t-num text-fg-2 text-body">{sell}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="-mx-1">
        <Sparkline data={sparklineData} color={color} height={48} />
      </div>

      {/* Footer: status mercado + última atualização */}
      <div
        className="pt-2 mt-1 border-t border-border-1 flex items-center justify-between gap-2"
        title={lastSync ? `Última atualização: ${new Date(lastSync).toLocaleString('pt-BR')}` : undefined}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-pill shrink-0"
            style={{
              background: dotColor,
              boxShadow: isOpen
                ? `0 0 6px ${dotColor}`
                : 'none',
              animation,
            }}
          />
          <span
            className="eyebrow truncate"
            style={{ color: dotColor }}
          >
            {stateLabel}
          </span>
        </div>
        <span className="text-micro text-fg-3 t-num shrink-0">
          {since}
        </span>
      </div>
    </Card>
  )
}
