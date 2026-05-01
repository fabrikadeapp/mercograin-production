import { ReactNode } from 'react'

interface AnimatedBadgeProps {
  children: ReactNode
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'indigo' | 'pink'
  pulse?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const colorMap = {
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  purple: 'bg-purple-100 text-purple-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  pink: 'bg-pink-100 text-pink-800',
}

const sizeMap = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
}

export function AnimatedBadge({
  children,
  color = 'blue',
  pulse = false,
  size = 'md',
}: AnimatedBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap transition-all duration-200 ${
        colorMap[color]
      } ${sizeMap[size]} ${pulse ? 'animate-pulse' : ''}`}
    >
      {children}
    </span>
  )
}
