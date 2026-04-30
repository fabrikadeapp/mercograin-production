import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/contexts/ToastContext'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'MercoGrain - Trading de Grãos',
  description: 'Sistema integrado de cotação, proposta, contrato e cobrança para trading de grãos',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50">
        <ToastProvider position="top-right">{children}</ToastProvider>
      </body>
    </html>
  )
}
