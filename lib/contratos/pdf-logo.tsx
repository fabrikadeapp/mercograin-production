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
}

/**
 * Logo do PDF — 2 níveis:
 *  1. Default: brand "BH Grain" desenhado inline (texto + bloco verde) — funciona offline
 *  2. Custom: logoUrl da workspace (DadosEmpresa.logoUrl), sobrescreve a default
 *
 * O componente <Image /> do @react-pdf/renderer aceita URLs http(s), data URLs
 * (data:image/png;base64,...) e paths absolutos do sistema de arquivos.
 */
export function PdfLogo({ customLogoUrl }: PdfLogoProps) {
  if (customLogoUrl && customLogoUrl.trim().length > 0) {
    try {
      return <Image src={customLogoUrl} style={styles.customLogo} />
    } catch {
      // fall through to default
    }
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
