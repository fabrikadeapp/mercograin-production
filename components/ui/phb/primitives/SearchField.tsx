'use client'
import * as React from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface SearchFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  shortcut?: string
  containerClassName?: string
}

export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ shortcut = '⌘K', className, containerClassName, ...props }, ref) => {
    return (
      <div
        className={cn(
          'relative flex items-center h-11 rounded-pill border border-border-1 transition-colors',
          'focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2',
          containerClassName
        )}
        style={{
          background: 'var(--bg-2)',
          // @ts-expect-error CSS var
          '--tw-ring-offset-color': 'var(--bg-0)',
        }}
      >
        <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-fg-3" />
        <input
          ref={ref}
          type="search"
          className={cn(
            'bg-transparent w-full h-full text-fg-1 text-body placeholder:text-fg-3 outline-none pl-11 pr-16',
            className
          )}
          {...props}
        />
        {shortcut ? (
          <kbd
            className="absolute right-3 top-1/2 -translate-y-1/2 px-2 h-6 rounded-sm text-micro font-mono flex items-center"
            style={{ background: 'var(--bg-3)', color: 'var(--fg-3)' }}
          >
            {shortcut}
          </kbd>
        ) : null}
      </div>
    )
  }
)
SearchField.displayName = 'SearchField'
