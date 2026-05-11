'use client'
import * as React from 'react'
import { TopNav } from './TopNav'

export interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-bg-0">
      <TopNav />
      <main className="flex-1 min-w-0">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-6 md:py-8">{children}</div>
      </main>
    </div>
  )
}
