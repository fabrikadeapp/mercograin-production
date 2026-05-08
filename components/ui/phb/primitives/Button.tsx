'use client'
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'icon'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: Variant
  size?: Size
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  loading?: boolean
  fullWidth?: boolean
}

const baseByVariant: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  icon: 'btn-icon',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      leftIcon,
      rightIcon,
      loading,
      fullWidth,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const sizeCls =
      size === 'sm' ? 'btn-sm' : size === 'lg' ? 'h-12 px-6 text-base' : ''
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          baseByVariant[variant],
          sizeCls,
          fullWidth && 'w-full',
          (disabled || loading) && 'opacity-50 cursor-not-allowed',
          'focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
          className
        )}
        {...props}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : leftIcon}
        {variant !== 'icon' && children}
        {rightIcon && !loading ? rightIcon : null}
      </button>
    )
  }
)
Button.displayName = 'Button'
