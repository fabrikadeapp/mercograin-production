'use client'
import * as React from 'react'
import { AdminSidebar } from './AdminSidebar'

export interface AdminShellProps {
  children: React.ReactNode
  user: { nome: string; email: string }
}

export function AdminShell({ children, user }: AdminShellProps) {
  return (
    <div className="flex min-h-screen bg-bg-0">
      <AdminSidebar user={user} />
      <main className="flex-1 min-w-0">
        {/* Linha superior fina indicando contexto privilegiado */}
        <div
          className="h-[2px] w-full"
          style={{
            background:
              'linear-gradient(90deg, var(--neg) 0%, var(--warn) 50%, var(--accent) 100%)',
            opacity: 0.6,
          }}
          aria-hidden="true"
        />
        <div className="max-w-[1440px] mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  )
}
