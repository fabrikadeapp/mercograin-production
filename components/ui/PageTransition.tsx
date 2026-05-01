'use client'

import { ReactNode } from 'react'

interface PageTransitionProps {
  children: ReactNode
  delay?: number
}

export function PageTransition({ children, delay = 0 }: PageTransitionProps) {
  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-2 duration-500"
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}
