import React, { useState, useRef, useEffect } from 'react'
import clsx from 'clsx'

interface SelectOption {
  value: string | number
  label: string
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: SelectOption[]
  label?: string
  error?: string
  helperText?: string
  placeholder?: string
  searchable?: boolean
  onChange?: (value: string | number) => void
  variant?: 'default' | 'filled'
}

export function Select({
  options,
  label,
  error,
  helperText,
  placeholder = 'Selecione uma opção',
  searchable = false,
  value,
  onChange,
  disabled,
  variant = 'default',
  className,
  ...props
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const filteredOptions = searchable
    ? options.filter((opt) => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options

  const selectedOption = options.find((opt) => opt.value === value)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const baseStyles = 'w-full px-4 py-2 rounded-lg transition-all duration-200 text-left'

  const variantStyles = {
    default: `
      border border-gray-300
      focus:border-blue-500 focus:ring-2 focus:ring-blue-200
      disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed
      ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}
    `,
    filled: `
      bg-gray-100 border border-transparent
      focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200
      disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
    `,
  }

  if (!searchable) {
    return (
      <div className="w-full">
        {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          className={clsx(baseStyles, variantStyles[variant], className)}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error ? (
          <p className="text-xs text-red-600 mt-1">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-gray-500 mt-1">{helperText}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="w-full" ref={containerRef}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className={clsx(
            baseStyles,
            variantStyles[variant],
            'flex items-center justify-between',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <span className={!selectedOption ? 'text-gray-400' : ''}>{selectedOption?.label || placeholder}</span>
          <svg className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
            {searchable && (
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border-b border-gray-200 focus:outline-none"
              />
            )}
            <div className="max-h-60 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-2 text-gray-500 text-sm">Nenhuma opção encontrada</div>
              ) : (
                filteredOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange?.(opt.value)
                      setIsOpen(false)
                      setSearchTerm('')
                    }}
                    className={clsx(
                      'w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors',
                      opt.value === value && 'bg-blue-100 text-blue-900 font-semibold'
                    )}
                  >
                    {opt.label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {error ? (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-gray-500 mt-1">{helperText}</p>
      ) : null}
    </div>
  )
}
