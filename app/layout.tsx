import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { ToastProvider } from '@/contexts/ToastContext'
import { SessionProviderClient } from '@/contexts/SessionProviderClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://www.profitsync.ia.br'),
  title: {
    default: 'PHB Grain — Mesa de operações para trading de grãos',
    template: '%s · PHB Grain',
  },
  description:
    'Cotações ao vivo CEPEA, contratos digitais, fluxo de caixa, WhatsApp Bot e relatórios — desenhado para tradings que precisam de precisão financeira e controle total da safra.',
  keywords: [
    'trading de grãos',
    'CEPEA',
    'cotação soja milho trigo',
    'contrato compra e venda grãos',
    'corretora de grãos',
    'gestão safra',
    'agronegócio Brasil',
  ],
  authors: [{ name: 'PHB Grain' }],
  creator: 'PHB Grain',
  publisher: 'PHB Grain',
  applicationName: 'PHB Grain',
  category: 'Agronegócio',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://www.profitsync.ia.br',
    siteName: 'PHB Grain',
    title: 'PHB Grain — Mesa de operações para trading de grãos',
    description:
      'Cotações ao vivo CEPEA + contratos + fluxo de caixa + WhatsApp Bot. Toda sua mesa de operações em um só lugar.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PHB Grain — Mesa de operações para trading de grãos',
    description:
      'Cotações ao vivo CEPEA + contratos + fluxo de caixa + WhatsApp Bot. Toda sua mesa em um só lugar.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://www.profitsync.ia.br',
  },
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
