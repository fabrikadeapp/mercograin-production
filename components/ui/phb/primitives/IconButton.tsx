'use client'
import * as React from 'react'
import { Button, ButtonProps } from './Button'
import { cn } from '@/lib/utils/cn'

export interface IconButtonProps extends Omit<ButtonProps, 'variant' | 'leftIcon' | 'rightIcon'> {
  badge?: string | number
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ children, badge, className, ...props }, ref) => {
    return (
      <span className="relative inline-flex">
        <Button ref={ref} variant="icon" className={cn(className)} {...props}>
          {children}
        </Button>
        {badge !== undefined && badge !== null && badge !== '' ? (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-pill text-[10px] font-semibold flex items-center justify-center"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
          >
            {badge}
          </span>
        ) : null}
      </span>
    )
  }
)
IconButton.displayName = 'IconButton'
