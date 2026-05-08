import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { ToastProvider } from '@/contexts/ToastContext'
import { SessionProviderClient } from '@/contexts/SessionProviderClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'PHB Grain — Grain Intelligence',
  description: 'Sistema integrado de cotação, proposta, contrato e cobrança para trading de grãos',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="pt-BR"
      data-palette="pulse"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="bg-bg-0 text-fg-1 font-sans antialiased min-h-screen">
        <SessionProviderClient>
          <ToastProvider position="top-right">{children}</ToastProvider>
        </SessionProviderClient>
      </body>
    </html>
  )
}
