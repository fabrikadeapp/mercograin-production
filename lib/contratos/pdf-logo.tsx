import React from 'react'
import { Image, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#0a8a3a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  logoMarkText: { color: '#ffffff', fontSize: 11, fontWeight: 700 },
  logoBrand: { fontSize: 16, fontWeight: 700, color: '#0a0a0a' },
  logoBrandLight: { fontSize: 16, fontWeight: 400, color: '#0a8a3a' },
  customLogo: { width: 120, maxHeight: 48, objectFit: 'contain' },
})

export interface PdfLogoProps {
  customLogoUrl?: string | null
  /** Nome da corretora — usado no fallback quando não há logo PNG/JPG. */
  brandNome?: string | null
}

/**
 * Logo do PDF — 2 níveis:
 *  1. Default: brand "BH Grain" desenhado inline (texto + bloco verde) — funciona offline
 *  2. Custom: logoUrl da workspace (DadosEmpresa.logoUrl), sobrescreve a default
 *
 * O componente <Image /> do @react-pdf/renderer aceita URLs http(s), data URLs
 * (data:image/png;base64,...) e paths absolutos do sistema de arquivos.
 */
function isSvgUrl(url: string): boolean {
  return /\.svg(\?|#|$)/i.test(url)
}

export function PdfLogo({ customLogoUrl, brandNome }: PdfLogoProps) {
  // react-pdf não renderiza SVG no <Image/> — ignora e usa default em texto.
  if (customLogoUrl && customLogoUrl.trim().length > 0 && !isSvgUrl(customLogoUrl)) {
    try {
      return <Image src={customLogoUrl} style={styles.customLogo} />
    } catch {
      // fall through to default
    }
  }
  // Fallback dinâmico: usa o nome da corretora quando disponível.
  const brand = (brandNome ?? '').trim()
  if (brand) {
    const initials = brand
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()
    return (
      <View style={styles.logoContainer}>
        <View style={styles.logoMark}>
          <Text style={styles.logoMarkText}>{initials || 'M'}</Text>
        </View>
        <Text style={styles.logoBrand}>{brand}</Text>
      </View>
    )
  }
  return (
    <View style={styles.logoContainer}>
      <View style={styles.logoMark}>
        <Text style={styles.logoMarkText}>BH</Text>
      </View>
      <Text style={styles.logoBrand}>
        BH <Text style={styles.logoBrandLight}>Grain</Text>
      </Text>
    </View>
  )
}
