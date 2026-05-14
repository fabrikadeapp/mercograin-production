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
          {eyebrow ? (
            <p
              style={{
                fontFamily: 'var(--f-mono)',
                fontSize: 11,
                color: 'var(--text-dim)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              {eyebrow}
            </p>
          ) : null}
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--text)',
              fontFamily: 'var(--f-sans)',
              margin: '4px 0 0',
            }}
            className="tracking-tight"
          >
            {title}
          </h1>
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
      {subtitle ? (
        <p
          style={{
            fontFamily: 'var(--f-serif)',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 16,
            color: 'var(--text-mute)',
            margin: '4px 0 0',
            letterSpacing: '-0.005em',
          }}
        >
          {subtitle}
        </p>
      ) : null}
    </header>
  )
}
