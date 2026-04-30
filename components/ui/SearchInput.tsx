import React, { useState, useCallback, useEffect } from 'react'
import clsx from 'clsx'

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onSearch: (value: string) => void
  debounceMs?: number
  placeholder?: string
  icon?: React.ReactNode
}

export function SearchInput({
  onSearch,
  debounceMs = 300,
  placeholder = 'Buscar...',
  icon,
  className,
  ...props
}: SearchInputProps) {
  const [value, setValue] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  const debouncedSearch = useCallback(
    (searchValue: string) => {
      const timer = setTimeout(() => {
        onSearch(searchValue)
        setIsSearching(false)
      }, debounceMs)

      return () => clearTimeout(timer)
    },
    [onSearch, debounceMs]
  )

  useEffect(() => {
    setIsSearching(true)
    const cleanup = debouncedSearch(value)
    return cleanup
  }, [value, debouncedSearch])

  return (
    <div className="relative w-full">
      {icon ? (
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">{icon}</div>
      ) : (
        <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className={clsx(
          'w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300',
          'focus:border-blue-500 focus:ring-2 focus:ring-blue-200',
          'transition-all duration-200',
          className
        )}
        {...props}
      />
      {isSearching && value && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
        </div>
      )}
    </div>
  )
}
