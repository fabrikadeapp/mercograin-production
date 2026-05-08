'use client'
import * as React from 'react'
import { Chip } from '@/components/ui/phb'
import { cn } from '@/lib/utils/cn'

/* -------- StatusBadge: subscription status -> Chip -------- */
export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Chip variant="neutral">Sem assinatura</Chip>
  const map: Record<
    string,
    { label: string; variant: 'pos' | 'neg' | 'warn' | 'neutral' }
  > = {
    active: { label: 'Ativo', variant: 'pos' },
    trialing: { label: 'Trial', variant: 'warn' },
    past_due: { label: 'Em atraso', variant: 'neg' },
    unpaid: { label: 'Inadimplente', variant: 'neg' },
    canceled: { label: 'Cancelado', variant: 'neutral' },
    incomplete: { label: 'Incompleto', variant: 'warn' },
    incomplete_expired: { label: 'Expirado', variant: 'neutral' },
  }
  const cfg = map[status] ?? { label: status, variant: 'neutral' as const }
  return <Chip variant={cfg.variant}>{cfg.label}</Chip>
}

/* -------- HealthIndicator: dot + label + ms -------- */
export function HealthIndicator({
  ok,
  label,
  detail,
  ms,
}: {
  ok: boolean
  label: string
  detail?: string
  ms?: number
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'inline-block h-2.5 w-2.5 rounded-full',
          ok ? 'animate-pulse' : '',
        )}
        style={{ background: ok ? 'var(--pos)' : 'var(--neg)' }}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <div className="text-fg-1 text-small font-medium">{label}</div>
        {detail ? (
          <div className="text-fg-3 text-micro truncate">{detail}</div>
        ) : null}
      </div>
      {typeof ms === 'number' ? (
        <span className="text-fg-3 text-micro font-mono tabular-nums">
          {ms}ms
        </span>
      ) : null}
    </div>
  )
}

/* -------- MoneyValue: BRL -------- */
export function MoneyValue({
  cents,
  className,
}: {
  cents: number | null | undefined
  className?: string
}) {
  const v = (cents ?? 0) / 100
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(v)
  return (
    <span className={cn('font-mono tabular-nums', className)}>{formatted}</span>
  )
}

/* -------- RelativeTime -------- */
export function RelativeTime({
  date,
}: {
  date: Date | string | null | undefined
}) {
  if (!date) return <span className="text-fg-3">—</span>
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const sec = Math.floor(diff / 1000)
  const min = Math.floor(sec / 60)
  const h = Math.floor(min / 60)
  const day = Math.floor(h / 24)
  let label: string
  if (sec < 5) label = 'agora'
  else if (sec < 60) label = `há ${sec}s`
  else if (min < 60) label = `há ${min}min`
  else if (h < 24) label = `há ${h}h`
  else if (day < 30) label = `há ${day}d`
  else label = d.toLocaleDateString('pt-BR')
  return (
    <span className="text-fg-3 text-small" title={d.toLocaleString('pt-BR')}>
      {label}
    </span>
  )
}

/* -------- PlanBadge -------- */
export function PlanBadge({ plan }: { plan: string | null | undefined }) {
  if (!plan) return <span className="text-fg-3 text-small">—</span>
  const map: Record<string, string> = {
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Enterprise',
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-pill text-micro font-semibold uppercase tracking-wider border border-border-2 bg-bg-2 text-fg-2"
    >
      {map[plan] ?? plan}
    </span>
  )
}
