import React from 'react'
import clsx from 'clsx'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullScreen?: boolean
}

export function LoadingSpinner({ size = 'md', text, fullScreen = false }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-6 w-6 border-2',
    md: 'h-12 w-12 border-4',
    lg: 'h-16 w-16 border-4',
  }

  const spinner = (
    <div className={clsx('animate-spin rounded-full border-b-2 border-blue-600', sizeClasses[size])} />
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 shadow-lg flex flex-col items-center gap-4">
          {spinner}
          {text && <p className="text-gray-700 font-medium">{text}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      {spinner}
      {text && <p className="text-gray-700 text-sm">{text}</p>}
    </div>
  )
}
