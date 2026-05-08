'use client'
import * as React from 'react'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { SearchField } from '../primitives/SearchField'
import { IconButton } from '../primitives/IconButton'

export interface PageHeaderProps {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
  search?: boolean
  searchPlaceholder?: string
  showBell?: boolean
  className?: string
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  search = true,
  searchPlaceholder = 'Buscar contratos, clientes, lotes…',
  showBell = true,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('space-y-1 mb-8', className)}>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-1 min-w-0">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="text-h1 font-sans tracking-tight text-fg-1">{title}</h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {search ? (
            <SearchField
              placeholder={searchPlaceholder}
              containerClassName="w-80"
            />
          ) : null}
          {showBell ? (
            <IconButton aria-label="Notificações" badge={3}>
              <Bell className="h-4 w-4" />
            </IconButton>
          ) : null}
          {actions}
        </div>
      </div>
      {subtitle ? <p className="text-fg-3 text-small">{subtitle}</p> : null}
    </header>
  )
}
