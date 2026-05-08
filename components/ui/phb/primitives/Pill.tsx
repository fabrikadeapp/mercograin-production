'use client'
import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  leftIcon?: React.ReactNode
}

export const Pill = React.forwardRef<HTMLSpanElement, PillProps>(
  ({ leftIcon, className, children, ...props }, ref) => {
    return (
      <span ref={ref} className={cn('pill', className)} {...props}>
        {leftIcon}
        {children}
      </span>
    )
  }
)
Pill.displayName = 'Pill'
