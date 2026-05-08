'use client'
import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'

export interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  cta?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  cta,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-10 px-6 ${className}`}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bg-2 text-fg-3">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-h3 text-fg-1 mb-1">{title}</h3>
      {description ? (
        <p className="text-fg-3 text-small max-w-sm">{description}</p>
      ) : null}
      {cta ? <div className="mt-4">{cta}</div> : null}
    </div>
  )
}
