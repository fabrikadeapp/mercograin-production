import React, { useState } from 'react'
import clsx from 'clsx'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  error?: string
  helperText?: string
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'date' | 'datetime-local'
  mask?: 'cpf' | 'cnpj' | 'phone' | 'currency'
  icon?: React.ReactNode
  variant?: 'default' | 'filled'
}

function applyMask(value: string, mask: string): string {
  let masked = value.replace(/\D/g, '')

  switch (mask) {
    case 'cpf':
      masked = masked.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      break
    case 'cnpj':
      masked = masked.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d)/, '$1-$2')
      break
    case 'phone':
      masked = masked.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
      break
    case 'currency':
      const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
      const num = parseInt(masked) / 100 || 0
      masked = formatter.format(num)
      break
  }

  return masked
}

export function Input({
  label,
  error,
  helperText,
  type = 'text',
  mask,
  icon,
  variant = 'default',
  value,
  onChange,
  disabled,
  className,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value

    if (mask) {
      newValue = applyMask(newValue, mask)
    }

    e.target.value = newValue
    onChange?.(e)
  }

  const baseStyles = 'w-full px-4 py-2 rounded-lg transition-all duration-200'

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

  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">{icon}</div>}
        <input
          type={type}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={clsx(baseStyles, variantStyles[variant], icon && 'pl-10', className)}
          {...props}
        />
      </div>
      {error ? (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-gray-500 mt-1">{helperText}</p>
      ) : null}
    </div>
  )
}
