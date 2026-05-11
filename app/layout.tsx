import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Urbanist } from 'next/font/google'
import './globals.css'

const urbanist = Urbanist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-urbanist',
  weight: ['300', '400', '500', '600', '700'],
})
import { ToastProvider } from '@/contexts/ToastContext'
import { SessionProviderClient } from '@/contexts/SessionProviderClient'
import { getUiTheme } from '@/lib/ui/theme'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://www.profitsync.ia.br'),
  title: {
    default: 'BH Grain — Mesa de operações para trading de grãos',
    template: '%s · BH Grain',
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
  authors: [{ name: 'BH Grain' }],
  creator: 'BH Grain',
  publisher: 'BH Grain',
  applicationName: 'BH Grain',
  category: 'Agronegócio',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://www.profitsync.ia.br',
    siteName: 'BH Grain',
    title: 'BH Grain — Mesa de operações para trading de grãos',
    description:
      'Cotações ao vivo CEPEA + contratos + fluxo de caixa + WhatsApp Bot. Toda sua mesa de operações em um só lugar.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BH Grain — Mesa de operações para trading de grãos',
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
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black',
    title: 'BH Grain',
  },
}

export const viewport = {
  themeColor: '#0F7305',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const theme = await getUiTheme().catch(() => 'phb' as const)
  return (
    <html
      lang="pt-BR"
      data-palette="synthex"
      data-theme={theme}
      className={`${GeistSans.variable} ${GeistMono.variable} ${urbanist.variable}`}
    >
      <body className="bg-bg-0 text-fg-1 font-sans antialiased min-h-screen">
        <SessionProviderClient>
          <ToastProvider position="top-right">{children}</ToastProvider>
        </SessionProviderClient>
      </body>
    </html>
  )
}
