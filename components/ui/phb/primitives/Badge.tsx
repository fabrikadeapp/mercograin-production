'use client'
import * as React from 'react'
import { Chip, ChipVariant } from './Chip'

export type BadgeStatus =
  | 'assinado'
  | 'pendente'
  | 'rascunho'
  | 'cancelado'
  | 'fechado'
  | 'em-negociacao'

const statusToChip: Record<BadgeStatus, ChipVariant> = {
  assinado: 'pos',
  pendente: 'warn',
  rascunho: 'neutral',
  cancelado: 'neg',
  fechado: 'info',
  'em-negociacao': 'accent',
}

function titleCase(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '—'
  return input
    .split(/[-_]/)
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ')
}

export interface BadgeProps {
  /** Se receber valor não mapeado, renderiza o próprio valor com chip neutro. */
  variant: BadgeStatus | string | undefined | null
  className?: string
}

export function Badge({ variant, className }: BadgeProps) {
  const safeVariant = typeof variant === 'string' ? variant : ''
  const chipVariant: ChipVariant =
    (statusToChip as Record<string, ChipVariant>)[safeVariant] ?? 'neutral'
  return (
    <Chip variant={chipVariant} className={className}>
      {titleCase(safeVariant)}
    </Chip>
  )
}

export type GrainVariant = 'soja' | 'milho' | 'trigo' | 'sorgo' | 'usd'

const grainColor: Record<GrainVariant, string> = {
  soja: 'var(--grain-soja)',
  milho: 'var(--grain-milho)',
  trigo: 'var(--grain-trigo)',
  sorgo: 'var(--grain-soja)',
  usd: 'var(--grain-usd)',
}

const grainLabel: Record<GrainVariant, string> = {
  soja: 'Soja',
  milho: 'Milho',
  trigo: 'Trigo',
  sorgo: 'Sorgo',
  usd: 'USD',
}

export interface GrainBadgeProps {
  variant: GrainVariant
  label?: string
  className?: string
}

export function GrainBadge({ variant, label, className }: GrainBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 h-6 px-2.5 rounded-pill text-small font-medium ${className ?? ''}`}
      style={{ background: 'var(--bg-2)', color: 'var(--fg-2)', border: '1px solid var(--border-1)' }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: grainColor[variant] }}
      />
      {label ?? grainLabel[variant]}
    </span>
  )
}
