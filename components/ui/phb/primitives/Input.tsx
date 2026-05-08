'use client'
import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  leftIcon?: React.ReactNode
  rightAddon?: React.ReactNode
  error?: string
  helperText?: string
  containerClassName?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      leftIcon,
      rightAddon,
      error,
      helperText,
      className,
      containerClassName,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || React.useId()
    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        {label ? (
          <label htmlFor={inputId} className="eyebrow">
            {label}
          </label>
        ) : null}
        <div
          className={cn(
            'relative flex items-center h-11 rounded-md border transition-colors',
            'focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2',
            error ? 'border-neg' : 'border-border-1 hover:border-border-2'
          )}
          style={{
            background: 'var(--bg-2)',
            // @ts-expect-error CSS var
            '--tw-ring-offset-color': 'var(--bg-0)',
          }}
        >
          {leftIcon ? (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3 flex items-center">
              {leftIcon}
            </span>
          ) : null}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'bg-transparent w-full h-full text-fg-1 text-body placeholder:text-fg-3 outline-none px-4',
              leftIcon ? 'pl-10' : '',
              rightAddon ? 'pr-16' : '',
              className
            )}
            {...props}
          />
          {rightAddon ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-3 text-small">
              {rightAddon}
            </span>
          ) : null}
        </div>
        {error ? (
          <p className="text-small text-neg">{error}</p>
        ) : helperText ? (
          <p className="text-small text-fg-3">{helperText}</p>
        ) : null}
      </div>
    )
  }
)
Input.displayName = 'Input'
