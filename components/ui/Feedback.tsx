'use client'

import { ReactNode } from 'react'

interface FeedbackProps {
  type: 'success' | 'error' | 'warning' | 'info'
  children: ReactNode
  icon?: ReactNode
  animate?: boolean
}

const typeConfig = {
  success: {
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-800',
    icon: '✅',
  },
  error: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-800',
    icon: '❌',
  },
  warning: {
    bg: 'bg-yellow-50 border-yellow-200',
    text: 'text-yellow-800',
    icon: '⚠️',
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-800',
    icon: 'ℹ️',
  },
}

export function Feedback({ type, children, icon, animate = true }: FeedbackProps) {
  const config = typeConfig[type]

  return (
    <div
      className={`border rounded-lg p-4 ${config.bg} ${
        animate ? 'animate-in fade-in slide-in-from-top-2 duration-300' : ''
      }`}
    >
      <div className={`flex items-start gap-3 ${config.text}`}>
        <span className="text-xl flex-shrink-0">{icon || config.icon}</span>
        <div className="flex-1 text-sm">{children}</div>
      </div>
    </div>
  )
}
