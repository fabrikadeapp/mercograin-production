'use client'
import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string
  leftIcon?: React.ReactNode
  options: SelectOption[]
  error?: string
  helperText?: string
  containerClassName?: string
  placeholder?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      leftIcon,
      options,
      error,
      helperText,
      className,
      containerClassName,
      placeholder,
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id || React.useId()
    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        {label ? (
          <label htmlFor={selectId} className="eyebrow">
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
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? 'true' : undefined}
            className={cn(
              'appearance-none bg-transparent w-full h-full text-fg-1 text-body outline-none px-4 pr-10',
              leftIcon ? 'pl-10' : '',
              className
            )}
            {...props}
          >
            {placeholder ? (
              <option value="" disabled>
                {placeholder}
              </option>
            ) : null}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-bg-2 text-fg-1">
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-fg-3 pointer-events-none" />
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
Select.displayName = 'Select'
