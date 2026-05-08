'use client'
import * as React from 'react'
import { Bell } from 'lucide-react'
import { Chip, ChipVariant } from '../primitives/Chip'
import { cn } from '@/lib/utils/cn'

export interface AlertItemProps {
  label: string
  status: string
  variant?: ChipVariant
  iconColor?: string
  className?: string
}

export function AlertItem({
  label,
  status,
  variant = 'neutral',
  iconColor = 'var(--warn)',
  className,
}: AlertItemProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 py-3 border-b border-border-1 last:border-0',
        className,
      )}
    >
      <Bell className="h-4 w-4 shrink-0" style={{ color: iconColor }} />
      <span className="flex-1 text-fg-1 text-small truncate">{label}</span>
      <Chip variant={variant}>{status}</Chip>
    </div>
  )
}
