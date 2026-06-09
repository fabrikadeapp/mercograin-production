import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import {
  Urbanist,
  Inter,
  JetBrains_Mono,
  Instrument_Serif,
  IBM_Plex_Sans,
  IBM_Plex_Mono,
  Fraunces,
  Newsreader,
  Libre_Franklin,
  Manrope,
  Spline_Sans_Mono,
  Space_Grotesk,
  Lexend,
  DM_Mono,
  DM_Sans,
  Public_Sans,
  Martian_Mono,
  Instrument_Sans,
} from 'next/font/google'
import './globals.css'

const urbanist = Urbanist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-urbanist',
  weight: ['300', '400', '500', '600', '700'],
})

// Design v2 — fontes NewDB
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '600'],
})
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-instrument-serif',
  weight: ['400'],
  style: ['normal', 'italic'],
})

// ── Fontes dos design systems selecionáveis pela corretora ──────────────
// (lib/ui/design-systems.ts). Cada tema usa um subconjunto via var(--font-*).
const ibmPlexSans = IBM_Plex_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-ibm-plex-sans', weight: ['400', '500', '600', '700'] })
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], display: 'swap', variable: '--font-ibm-plex-mono', weight: ['400', '500', '600'] })
const fraunces = Fraunces({ subsets: ['latin'], display: 'swap', variable: '--font-fraunces', style: ['normal', 'italic'] })
const newsreader = Newsreader({ subsets: ['latin'], display: 'swap', variable: '--font-newsreader', style: ['normal', 'italic'] })
const libreFranklin = Libre_Franklin({ subsets: ['latin'], display: 'swap', variable: '--font-libre-franklin', weight: ['400', '500', '600', '700'] })
const manrope = Manrope({ subsets: ['latin'], display: 'swap', variable: '--font-manrope', weight: ['400', '500', '600', '700', '800'] })
const splineMono = Spline_Sans_Mono({ subsets: ['latin'], display: 'swap', variable: '--font-spline-mono', weight: ['400', '500', '600'] })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-space-grotesk', weight: ['400', '500', '600', '700'] })
const lexend = Lexend({ subsets: ['latin'], display: 'swap', variable: '--font-lexend', weight: ['400', '500', '600', '700'] })
const dmMono = DM_Mono({ subsets: ['latin'], display: 'swap', variable: '--font-dm-mono', weight: ['400', '500'] })
const dmSans = DM_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-dm-sans', weight: ['400', '500', '600', '700'] })
const publicSans = Public_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-public-sans', weight: ['400', '500', '600', '700'] })
const martianMono = Martian_Mono({ subsets: ['latin'], display: 'swap', variable: '--font-martian-mono', weight: ['400', '500', '600'] })
const instrumentSans = Instrument_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-instrument-sans', weight: ['400', '500', '600', '700'] })
import { ToastProvider } from '@/contexts/ToastContext'
import { SessionProviderClient } from '@/contexts/SessionProviderClient'
import { getWorkspaceDesignSystem } from '@/lib/ui/workspace-theme'

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
  // Tema (design system) resolvido por workspace no SSR — todos os usuários da
  // corretora veem o mesmo tema. Sem override por usuário, sem FOUC (vem pronto
  // do servidor), sem boot script de localStorage.
  const designSystem = await getWorkspaceDesignSystem()
  return (
    <html
      lang="pt-BR"
      data-palette="synthex"
      data-theme={designSystem}
      className={`${GeistSans.variable} ${GeistMono.variable} ${urbanist.variable} ${inter.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} ${fraunces.variable} ${newsreader.variable} ${libreFranklin.variable} ${manrope.variable} ${splineMono.variable} ${spaceGrotesk.variable} ${lexend.variable} ${dmMono.variable} ${dmSans.variable} ${publicSans.variable} ${martianMono.variable} ${instrumentSans.variable}`}
    >
      <head />
      <body className="bg-bg-0 text-fg-1 font-sans antialiased min-h-screen">
        <SessionProviderClient>
          <ToastProvider position="top-right">{children}</ToastProvider>
        </SessionProviderClient>
      </body>
    </html>
  )
}
