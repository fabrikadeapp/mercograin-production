/**
 * Página de evidências da assinatura nativa (Lei 14.063/2020).
 *
 * Gera um PDF standalone com:
 *  - Identificação do documento e do hash SHA-256 do PDF
 *  - Para cada signatário: nome, CPF/CNPJ (mascarado), email mascarado,
 *    IP, user-agent, accept-language, timestamp UTC e local,
 *    geolocalização (truncada) se fornecida.
 *  - Protocolo da coleta (providerDocId)
 *  - Aviso de validade legal
 *
 * Vide docs/specs/assinaturapropriaonline.md §7.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer'
import React from 'react'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#222',
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: '#0a5f2a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: '#555',
    marginBottom: 18,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: 700,
    color: '#0a8a3a',
    marginTop: 16,
    marginBottom: 6,
    borderBottom: '1px solid #0a8a3a',
    paddingBottom: 2,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  label: {
    width: 110,
    color: '#666',
    fontSize: 9,
  },
  value: {
    flex: 1,
    color: '#222',
    fontSize: 10,
  },
  mono: {
    fontFamily: 'Courier',
    fontSize: 9,
    color: '#222',
  },
  signatoryBox: {
    border: '1px solid #ddd',
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#fafafa',
  },
  signatoryName: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 4,
    color: '#1a1a1a',
  },
  signedBadge: {
    fontSize: 9,
    color: '#0a8a3a',
    fontWeight: 700,
    marginBottom: 6,
  },
  pendingBadge: {
    fontSize: 9,
    color: '#c0392b',
    fontWeight: 700,
    marginBottom: 6,
  },
  legalNote: {
    marginTop: 24,
    padding: 10,
    border: '1px solid #ccc',
    backgroundColor: '#fbfbfb',
    fontSize: 9,
    lineHeight: 1.5,
    color: '#444',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#999',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
})

function maskEmail(email: string | null | undefined): string {
  if (!email) return '—'
  const [local, domain] = email.split('@')
  if (!domain) return email
  const head = local.slice(0, 2)
  return `${head}${'*'.repeat(Math.max(local.length - 2, 1))}@${domain}`
}

function maskCpfCnpj(doc: string | null | undefined): string {
  if (!doc) return '—'
  const d = doc.replace(/\D/g, '')
  if (d.length === 11) {
    return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`
  }
  if (d.length === 14) {
    return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-**`
  }
  return doc
}

function maskIp(ip: string | null | undefined): string {
  if (!ip) return '—'
  // IPv4: oculta último octeto. IPv6: oculta últimos 80 bits.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    return ip.replace(/(\d+\.\d+\.\d+)\.\d+/, '$1.***')
  }
  if (ip.includes(':')) {
    const parts = ip.split(':')
    return parts.slice(0, 3).join(':') + ':***'
  }
  return ip
}

function fmtData(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime())) return '—'
  const local = date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  })
  const utc = date.toISOString()
  return `${local} (UTC: ${utc})`
}

export interface SignatarioEvidencia {
  nome?: string
  email?: string
  cpfCnpj?: string
  telefone?: string
  signedAt?: string | null
  refusedAt?: string | null
  ip?: string | null
  ua?: string | null
  acceptLanguage?: string | null
  authMode?: string
  geo?: { lat: number; lng: number } | null
}

export interface EvidenciaProps {
  contratoNumero: string
  clienteNome: string
  brandNome?: string
  providerDocId: string
  pdfOriginalHash?: string | null
  pdfAssinadoHash?: string | null
  enviadoEm?: string | Date | null
  finalizadoEm?: string | Date | null
  status: string
  signatarios: SignatarioEvidencia[]
}

export function EvidenciaPdf(p: EvidenciaProps) {
  const geradoEm = fmtData(new Date())
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>
          Página de Evidências de Assinatura Eletrônica
        </Text>
        <Text style={styles.subtitle}>
          {p.brandNome ?? 'Documento'} · Gerado em {geradoEm} · powered by BH Grain
        </Text>

        <Text style={styles.sectionHeader}>Documento</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Contrato</Text>
          <Text style={styles.value}>{p.contratoNumero}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Cliente</Text>
          <Text style={styles.value}>{p.clienteNome}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Protocolo</Text>
          <Text style={[styles.value, styles.mono]}>{p.providerDocId}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{p.status}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Enviado em</Text>
          <Text style={styles.value}>{fmtData(p.enviadoEm)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Finalizado em</Text>
          <Text style={styles.value}>{fmtData(p.finalizadoEm)}</Text>
        </View>

        <Text style={styles.sectionHeader}>Integridade do PDF</Text>
        <View style={styles.row}>
          <Text style={styles.label}>SHA-256 original</Text>
          <Text style={[styles.value, styles.mono]}>
            {p.pdfOriginalHash ?? '—'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>SHA-256 final</Text>
          <Text style={[styles.value, styles.mono]}>
            {p.pdfAssinadoHash ?? p.pdfOriginalHash ?? '—'}
          </Text>
        </View>

        <Text style={styles.sectionHeader}>
          Signatários ({p.signatarios.length})
        </Text>
        {p.signatarios.map((s, i) => (
          <View key={i} style={styles.signatoryBox} wrap={false}>
            <Text style={styles.signatoryName}>
              {i + 1}. {s.nome ?? '—'}
            </Text>
            {s.signedAt ? (
              <Text style={styles.signedBadge}>
                ✓ ASSINADO EM {fmtData(s.signedAt)}
              </Text>
            ) : s.refusedAt ? (
              <Text style={styles.pendingBadge}>
                ✗ RECUSADO EM {fmtData(s.refusedAt)}
              </Text>
            ) : (
              <Text style={styles.pendingBadge}>○ Pendente</Text>
            )}
            <View style={styles.row}>
              <Text style={styles.label}>CPF/CNPJ</Text>
              <Text style={styles.value}>{maskCpfCnpj(s.cpfCnpj)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>E-mail</Text>
              <Text style={styles.value}>{maskEmail(s.email)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Modo de auth</Text>
              <Text style={styles.value}>{s.authMode ?? '—'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>IP (mascarado)</Text>
              <Text style={[styles.value, styles.mono]}>{maskIp(s.ip)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Dispositivo</Text>
              <Text style={styles.value}>
                {(s.ua ?? '—').slice(0, 140)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Idioma</Text>
              <Text style={styles.value}>{s.acceptLanguage ?? '—'}</Text>
            </View>
            {s.geo ? (
              <View style={styles.row}>
                <Text style={styles.label}>Geo (≈)</Text>
                <Text style={[styles.value, styles.mono]}>
                  {s.geo.lat.toFixed(3)}, {s.geo.lng.toFixed(3)}
                </Text>
              </View>
            ) : null}
          </View>
        ))}

        <View style={styles.legalNote}>
          <Text>
            Este documento de evidências comprova a coleta de assinaturas
            eletrônicas simples conforme{' '}
            <Text style={{ fontWeight: 700 }}>Lei nº 14.063/2020</Text>, art. 4º,
            inciso I, válida para relações privadas entre as partes.{' '}
            Os dados pessoais foram tratados sob a hipótese de{' '}
            <Text style={{ fontWeight: 700 }}>execução de contrato</Text>{' '}
            (LGPD, art. 7º, V) e exercício regular de direitos em processo
            judicial (LGPD, art. 7º, VI). IP e CPF/CNPJ são exibidos parcialmente
            mascarados; valores completos permanecem nos registros internos
            sob controle do operador.
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            {p.brandNome ?? 'Documento'} · Evidência de assinatura · {p.contratoNumero} · powered by BH Grain
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}

export async function renderEvidenciaPdf(p: EvidenciaProps): Promise<Buffer> {
  const instance = pdf(<EvidenciaPdf {...p} />)
  const stream = await instance.toBuffer()
  if (Buffer.isBuffer(stream)) return stream
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    ;(stream as NodeJS.ReadableStream).on('data', (c: Buffer | string) =>
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)),
    )
    ;(stream as NodeJS.ReadableStream).on('end', () =>
      resolve(Buffer.concat(chunks)),
    )
    ;(stream as NodeJS.ReadableStream).on('error', reject)
  })
}
